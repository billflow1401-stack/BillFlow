const path = require('path');
const PdfPrinter = require('pdfmake/js/Printer').default || require('pdfmake/js/Printer');
const URLResolver = require('pdfmake/js/URLResolver').default || require('pdfmake/js/URLResolver');

// Configure Roboto TrueType fonts so Unicode characters (specifically INR ₹) render natively without glyph corruption
const robotoDir = path.join(__dirname, '../../node_modules/pdfmake/fonts/Roboto');
const fonts = {
  Roboto: {
    normal: path.join(robotoDir, 'Roboto-Regular.ttf'),
    bold: path.join(robotoDir, 'Roboto-Medium.ttf'),
    italics: path.join(robotoDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(robotoDir, 'Roboto-MediumItalic.ttf')
  },
  // Keep Helvetica fallback pointing to standard or Roboto
  Helvetica: {
    normal: path.join(robotoDir, 'Roboto-Regular.ttf'),
    bold: path.join(robotoDir, 'Roboto-Medium.ttf'),
    italics: path.join(robotoDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(robotoDir, 'Roboto-MediumItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts, null, new URLResolver(null));

function formatIndianIntegerString(intStr) {
  if (intStr.length <= 3) return intStr;
  const lastThree = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  const parts = [];
  let i = rest.length;
  while (i > 0) {
    const start = Math.max(0, i - 2);
    parts.unshift(rest.slice(start, i));
    i = start;
  }
  return parts.join(',') + ',' + lastThree;
}

const formatCurrency = (val, { isOptional = false } = {}) => {
  if (val === null || val === undefined || val === '') {
    return isOptional ? '-' : '-';
  }

  const str = String(val).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) {
    return '[Invalid Amount]';
  }

  const isNeg = str.startsWith('-');
  const absStr = isNeg ? str.slice(1) : str;
  const [intPart, decPart = ''] = absStr.split('.');
  const paddedDec = (decPart + '00').slice(0, 2);
  const formattedInt = formatIndianIntegerString(intPart);

  return `${isNeg ? '-' : ''}₹${formattedInt}.${paddedDec}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const safeImageNode = (logoData) => {
  if (!logoData || typeof logoData !== 'string') return null;
  if (logoData.startsWith('data:image/')) {
    return { image: logoData, width: 85, alignment: 'right', margin: [0, 0, 0, 6] };
  }
  return null;
};

const numberToIndianWords = (num) => {
  if (num === null || num === undefined || num === '') return '';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n) || n === 0) return 'Zero Rupees Only';

  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigits = (val) => {
    if (val < 10) return single[val];
    if (val < 20) return double[val - 10];
    return tens[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + single[val % 10] : '');
  };

  const convertThreeDigits = (val) => {
    let str = '';
    if (val >= 100) {
      str += single[Math.floor(val / 100)] + ' Hundred';
      val %= 100;
      if (val > 0) str += ' ';
    }
    if (val > 0) {
      str += convertTwoDigits(val);
    }
    return str.trim();
  };

  const rupees = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - rupees) * 100);

  const crore = Math.floor(rupees / 10000000);
  const remCrore = rupees % 10000000;
  const lakh = Math.floor(remCrore / 100000);
  const remLakh = remCrore % 100000;
  const thousand = Math.floor(remLakh / 1000);
  const remThousand = remLakh % 1000;

  const words = [];
  if (crore > 0) words.push(convertThreeDigits(crore) + ' Crore');
  if (lakh > 0) words.push(convertTwoDigits(lakh) + ' Lakh');
  if (thousand > 0) words.push(convertTwoDigits(thousand) + ' Thousand');
  if (remThousand > 0) words.push(convertThreeDigits(remThousand));

  let result = (words.length > 0 ? words.join(' ') : 'Zero') + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  result += ' Only';
  return (n < 0 ? 'Minus ' : '') + result;
};

/**
 * Generate PDF stream from authoritative invoice data.
 * Does NOT perform any financial calculations.
 * Formats canonical rupee amounts into INR strings with ₹ symbol.
 */
const generateInvoicePdf = async (invoice, options = {}) => {
  const { businessSnapshot, customerSnapshot, summary, items, paymentStatus } = invoice;
  const isReceipt = options.type === 'receipt';
  const payments = options.payments || [];

  const isB2B = invoice.billingMode === 'GST-Registered' || Boolean(customerSnapshot?.gstin);
  const statusUpper = (invoice.status || 'UNPAID').toUpperCase();

  const isMultiPageReceipt = isReceipt && (
    (payments && payments.length > 2) ||
    (items && items.length > 3 && payments && payments.length > 1) ||
    (items && items.length > 5)
  );

  const signerName = businessSnapshot?.signature?.signerName || businessSnapshot?.ownerName || businessSnapshot?.name || 'Authorized Signatory';
  const signerDesignation = businessSnapshot?.signature?.designation || 'Authorized Signatory';
  const verificationCode = invoice.digitalSignature?.verificationCode || `BF-VER-${(invoice.invoiceNumber || 'INV').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  const signatureImg = (businessSnapshot?.signature?.url && businessSnapshot.signature.url.startsWith('data:image/'))
    ? businessSnapshot.signature.url
    : null;
  const sealImg = (businessSnapshot?.seal?.url && businessSnapshot.seal.url.startsWith('data:image/'))
    ? businessSnapshot.seal.url
    : null;

  // Status badge colors
  let statusColor = '#374151';
  let statusBg = '#F3F4F6';
  if (statusUpper === 'PAID') {
    statusColor = '#065F46'; // emerald-800
    statusBg = '#D1FAE5';    // emerald-100
  } else if (statusUpper === 'PARTIALLY PAID') {
    statusColor = '#92400E'; // amber-800
    statusBg = '#FEF3C7';    // amber-100
  } else if (statusUpper === 'UNPAID') {
    statusColor = '#1E40AF'; // blue-800
    statusBg = '#DBEAFE';    // blue-100
  } else if (statusUpper === 'OVERDUE') {
    statusColor = '#991B1B'; // red-800
    statusBg = '#FEE2E2';    // red-100
  }

  // Build items table body
  // Exact column widths sum to 531pt (A4 printable width with 32pt margins: 595.28 - 64 = 531.28pt)
  const tableBody = [
    [
      { text: 'SR.', style: 'tableHeader', alignment: 'center' },
      { text: 'ITEM DETAILS', style: 'tableHeader', alignment: 'left' },
      { text: 'HSN/SAC', style: 'tableHeader', alignment: 'center' },
      { text: 'QTY', style: 'tableHeader', alignment: 'right' },
      { text: 'RATE', style: 'tableHeader', alignment: 'right' },
      { text: 'DISC.', style: 'tableHeader', alignment: 'right' },
      { text: 'TAXABLE', style: 'tableHeader', alignment: 'right' },
      { text: 'GST%', style: 'tableHeader', alignment: 'center' },
      { text: 'GST AMT', style: 'tableHeader', alignment: 'right' },
      { text: 'TOTAL', style: 'tableHeader', alignment: 'right' }
    ]
  ];

  if (items && items.length > 0) {
    items.forEach((item, index) => {
      tableBody.push([
        { text: String(index + 1), style: 'tableCell', alignment: 'center' },
        {
          text: [
            { text: item.name, bold: true, fontSize: 8.5 },
            ...(item.description ? ['\n', { text: item.description, fontSize: 7.5, color: '#6B7280' }] : [])
          ],
          style: 'tableCell',
          alignment: 'left'
        },
        { text: item.hsnSac || '-', style: 'tableCell', alignment: 'center', noWrap: true },
        { text: `${item.quantity}${item.unit ? ' ' + item.unit : ''}`, style: 'tableCell', alignment: 'right', noWrap: true },
        { text: formatCurrency(item.unitPrice), style: 'tableCell', alignment: 'right', noWrap: true },
        { text: item.discount > 0 ? formatCurrency(item.discount) : '-', style: 'tableCell', alignment: 'right', noWrap: true },
        { text: formatCurrency(item.taxableValue), style: 'tableCell', alignment: 'right', bold: true, noWrap: true },
        { text: `${item.gstRate}%`, style: 'tableCell', alignment: 'center', noWrap: true },
        { text: formatCurrency(item.taxAmount), style: 'tableCell', alignment: 'right', noWrap: true },
        { text: formatCurrency(item.lineTotal), style: 'tableCell', alignment: 'right', bold: true, noWrap: true }
      ]);
    });
  }

  const bank = businessSnapshot?.bankDetails || {};
  const hasBankDetails = Boolean(bank.accountNumber || bank.ifsc || bank.bankName || bank.accountName || businessSnapshot?.pan);

  const businessAddressParts = [
    businessSnapshot?.address,
    businessSnapshot?.city,
    businessSnapshot?.state,
    businessSnapshot?.pinCode || businessSnapshot?.pincode,
    businessSnapshot?.country && businessSnapshot?.country !== 'India' ? businessSnapshot?.country : null
  ].filter(Boolean);
  const formattedBusinessAddress = businessAddressParts.join(', ');

  const customerAddressParts = [
    customerSnapshot?.billingAddress,
    customerSnapshot?.city,
    customerSnapshot?.state,
    customerSnapshot?.pinCode,
    customerSnapshot?.country && customerSnapshot.country !== 'India' ? customerSnapshot.country : null
  ].filter(Boolean);
  const formattedCustomerAddress = customerAddressParts.join(', ');

  const amountInWordsText = numberToIndianWords(summary.grandTotal);

  const docDefinition = {
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8.5,
      color: '#1F2937',
      lineHeight: 1.25
    },
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 32],
    content: [
      // 1. BUSINESS HEADER & DOCUMENT TITLE
      {
        columns: [
          // Left: Business Details
          {
            width: 320,
            stack: [
              { text: (businessSnapshot?.name || '').toUpperCase(), fontSize: 16, bold: true, color: '#111827', margin: [0, 0, 0, 1] },
              businessSnapshot?.tagline ? { text: businessSnapshot.tagline, fontSize: 8, italics: true, color: '#6B7280', margin: [0, 0, 0, 4] } : null,
              (businessSnapshot?.phone || businessSnapshot?.ownerName) ? {
                text: [
                  ...(businessSnapshot.ownerName ? [{ text: `${businessSnapshot.ownerName}   `, bold: true, fontSize: 8, color: '#111827' }] : []),
                  { text: `Phone: ${businessSnapshot.phone || ''}`, fontSize: 8, color: '#4B5563' },
                  businessSnapshot.alternatePhone ? { text: ` / ${businessSnapshot.alternatePhone}`, fontSize: 8, color: '#6B7280' } : ''
                ],
                margin: [0, 1, 0, 1]
              } : null,
              formattedBusinessAddress ? {
                text: formattedBusinessAddress,
                fontSize: 8,
                color: '#4B5563',
                margin: [0, 1, 0, 1]
              } : null,
              businessSnapshot?.email ? {
                text: `Email: ${businessSnapshot.email}`,
                fontSize: 8,
                color: '#4B5563',
                margin: [0, 1, 0, 1]
              } : null,
              (businessSnapshot?.gstin || businessSnapshot?.pan) ? {
                text: [
                  businessSnapshot.gstin ? { text: `GSTIN: ${businessSnapshot.gstin}    `, bold: true, fontSize: 8, color: '#111827' } : '',
                  businessSnapshot.pan ? { text: `PAN: ${businessSnapshot.pan}`, bold: true, fontSize: 8, color: '#111827' } : ''
                ],
                margin: [0, 2, 0, 0]
              } : null
            ].filter(Boolean)
          },

          // Center spacing gap
          { width: 11, text: '' },

          // Right: Document Title & Clean Metadata Table
          {
            width: 200,
            stack: [
              {
                text: invoice.status === 'Draft' ? 'DRAFT INVOICE' : (isReceipt ? 'PAYMENT RECEIPT' : (isB2B ? 'TAX INVOICE' : 'INVOICE')),
                fontSize: 20,
                bold: true,
                color: '#111827',
                alignment: 'right'
              },
              {
                text: isReceipt ? 'PAYMENT & SETTLEMENT RECEIPT' : (isB2B ? 'GST TAX INVOICE (B2B)' : 'ORIGINAL FOR RECIPIENT'),
                fontSize: 7.5,
                bold: true,
                color: '#9CA3AF',
                characterSpacing: 0.8,
                alignment: 'right',
                margin: [0, 1, 0, 6]
              },
              {
                table: {
                  widths: [75, '*'],
                  body: [
                    [
                      { text: 'Invoice No:', fontSize: 7.5, color: '#6B7280', bold: true },
                      { text: `#${invoice.invoiceNumber || '0000'}`, fontSize: 7.5, color: '#111827', bold: true, alignment: 'right' }
                    ],
                    [
                      { text: 'Invoice Date:', fontSize: 7.5, color: '#6B7280', bold: true },
                      { text: formatDate(invoice.date || invoice.createdAt), fontSize: 7.5, color: '#111827', alignment: 'right' }
                    ],
                    [
                      { text: 'Place of Supply:', fontSize: 7.5, color: '#6B7280', bold: true },
                      {
                        text: (() => {
                          const pos = invoice.placeOfSupply || customerSnapshot?.placeOfSupply || customerSnapshot?.state || 'Same as Supplier';
                          const code = invoice.placeOfSupplyStateCode || customerSnapshot?.placeOfSupplyStateCode;
                          return code ? `${pos} (${code})` : pos;
                        })(),
                        fontSize: 7.5,
                        color: '#111827',
                        alignment: 'right'
                      }
                    ],
                    ...(isReceipt ? [
                      [
                        { text: 'Status:', fontSize: 7.5, color: '#6B7280', bold: true },
                        {
                          table: {
                            body: [[{ text: statusUpper, fontSize: 6.5, bold: true, color: statusColor, alignment: 'center' }]]
                          },
                          layout: {
                            fillColor: () => statusBg,
                            hLineWidth: () => 0,
                            vLineWidth: () => 0,
                            paddingTop: () => 1,
                            paddingBottom: () => 1,
                            paddingLeft: () => 6,
                            paddingRight: () => 6
                          },
                          width: 'auto',
                          alignment: 'right'
                        }
                      ]
                    ] : [])
                  ]
                },
                layout: {
                  fillColor: '#F8FAFC',
                  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.75 : 0.5,
                  vLineWidth: () => 0.75,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0',
                  paddingTop: () => 3,
                  paddingBottom: () => 3,
                  paddingLeft: () => 8,
                  paddingRight: () => 8
                }
              }
            ]
          }
        ]
      },

      // Divider line (531pt total width)
      {
        margin: [0, 8, 0, 10],
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 0.75, lineColor: '#E2E8F0' }]
      },

      // 2. TWO-COLUMN BALANCED PARTIES & SETTLEMENT GRID
      {
        margin: [0, 0, 0, 12],
        columns: [
          // Left: BILLED TO / CUSTOMER
          {
            width: 258,
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        columns: [
                          { text: isB2B ? 'BILLED TO (REGISTERED RECIPIENT)' : 'BILLED TO (CUSTOMER / CLIENT)', fontSize: 7.5, bold: true, color: '#6B7280', characterSpacing: 0.5 },
                          { text: invoice.billingMode || 'General', fontSize: 7, color: '#9CA3AF', alignment: 'right' }
                        ]
                      },
                      { text: customerSnapshot?.name || 'Walk-in / Counter Sale', bold: true, fontSize: 10, color: '#111827', margin: [0, 3, 0, 2] },
                      formattedCustomerAddress ? { text: formattedCustomerAddress, fontSize: 8, color: '#4B5563', margin: [0, 1, 0, 1] } : null,
                      (Boolean(customerSnapshot?.showPhoneOnInvoice || invoice?.showPhoneOnInvoice) && customerSnapshot?.phone)
                        ? { text: `Phone: ${customerSnapshot.phone}`, fontSize: 8, color: '#4B5563' }
                        : null,
                      customerSnapshot?.email ? { text: `Email: ${customerSnapshot.email}`, fontSize: 8, color: '#4B5563' } : null,
                      customerSnapshot?.gstin ? {
                        text: [{ text: 'GSTIN: ', bold: true, color: '#6B7280' }, { text: customerSnapshot.gstin, bold: true, color: '#111827' }],
                        fontSize: 8,
                        margin: [0, 2, 0, 0]
                      } : null,
                      customerSnapshot?.pan ? {
                        text: [{ text: 'PAN: ', bold: true, color: '#6B7280' }, { text: customerSnapshot.pan, bold: true, color: '#111827' }],
                        fontSize: 8
                      } : null
                    ].filter(Boolean)
                  }
                ]
              ]
            },
            layout: {
              fillColor: '#F8FAFC',
              hLineWidth: () => 0.75,
              vLineWidth: () => 0.75,
              hLineColor: () => '#E2E8F0',
              vLineColor: () => '#E2E8F0',
              paddingTop: () => 6,
              paddingBottom: () => 6,
              paddingLeft: () => 8,
              paddingRight: () => 8
            }
          },

          // Center gap
          { width: 15, text: '' },

          // Right: BANK & SETTLEMENT DETAILS
          {
            width: 258,
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        columns: [
                          { text: 'BANK & PAYMENT DETAILS', fontSize: 7.5, bold: true, color: '#6B7280', characterSpacing: 0.5 },
                          {
                            table: {
                              body: [[{ text: 'NEFT / RTGS / IMPS', fontSize: 6.5, bold: true, color: '#047857', alignment: 'center' }]]
                            },
                            layout: {
                              fillColor: () => '#ECFDF5',
                              hLineWidth: () => 0.5,
                              vLineWidth: () => 0.5,
                              hLineColor: () => '#A7F3D0',
                              vLineColor: () => '#A7F3D0',
                              paddingTop: () => 1,
                              paddingBottom: () => 1,
                              paddingLeft: () => 4,
                              paddingRight: () => 4
                            },
                            width: 'auto',
                            alignment: 'right'
                          }
                        ]
                      },
                      hasBankDetails ? {
                        margin: [0, 3, 0, 0],
                        table: {
                          widths: [65, '*'],
                          body: [
                            ...(bank.bankName ? [[
                              { text: 'Bank Name:', fontSize: 7.5, color: '#6B7280', bold: true },
                              { text: bank.bankName, fontSize: 7.5, color: '#111827', bold: true }
                            ]] : []),
                            ...(bank.accountNumber ? [[
                              { text: 'Account No:', fontSize: 7.5, color: '#6B7280', bold: true },
                              { text: bank.accountNumber, fontSize: 7.5, color: '#111827', bold: true }
                            ]] : []),
                            ...(bank.ifsc ? [[
                              { text: 'IFSC Code:', fontSize: 7.5, color: '#6B7280', bold: true },
                              { text: bank.ifsc, fontSize: 7.5, color: '#111827', bold: true }
                            ]] : []),
                            ...(bank.accountName || businessSnapshot?.ownerName ? [[
                              { text: 'Beneficiary:', fontSize: 7.5, color: '#6B7280', bold: true },
                              { text: bank.accountName || businessSnapshot?.ownerName, fontSize: 7.5, color: '#111827' }
                            ]] : []),
                            ...(bank.branchName ? [[
                              { text: 'Branch:', fontSize: 7.5, color: '#6B7280', bold: true },
                              { text: bank.branchName, fontSize: 7.5, color: '#4B5563' }
                            ]] : []),
                            ...(businessSnapshot?.pan ? [[
                              { text: 'PAN Number:', fontSize: 7.5, color: '#6B7280', bold: true },
                              { text: businessSnapshot.pan, fontSize: 7.5, color: '#111827', bold: true }
                            ]] : [])
                          ]
                        },
                        layout: 'noBorders'
                      } : { text: 'No bank settlement details specified.', fontSize: 7.5, color: '#9CA3AF', italics: true, margin: [0, 4, 0, 0] }
                    ]
                  }
                ]
              ]
            },
            layout: {
              fillColor: '#F9FAFB',
              hLineWidth: () => 0.75,
              vLineWidth: () => 0.75,
              hLineColor: () => '#E5E7EB',
              vLineColor: () => '#E5E7EB',
              paddingTop: () => 6,
              paddingBottom: () => 6,
              paddingLeft: () => 8,
              paddingRight: () => 8
            }
          }
        ]
      },

      // 4. ITEMS TABLE (Proportional 531pt total)
      {
        margin: [0, 0, 0, 16],
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [16, '*', 42, 28, 44, 36, 48, 26, 44, 56],
          body: tableBody
        },
        layout: {
          fillColor: function (rowIndex) {
            if (rowIndex === 0) return '#F3F4F6';
            return (rowIndex % 2 === 0) ? '#FAFAFA' : '#FFFFFF';
          },
          hLineWidth: function (i, node) {
            if (i === 0 || i === 1 || i === node.table.body.length) return 1;
            return 0.5;
          },
          vLineWidth: () => 0,
          hLineColor: function (i, node) {
            if (i === 0 || i === 1 || i === node.table.body.length) return '#D1D5DB';
            return '#E5E7EB';
          },
          paddingTop: () => 5,
          paddingBottom: () => 5,
          paddingLeft: () => 2.5,
          paddingRight: () => 2.5
        }
      },

      // 5. TOTALS & SUMMARY SECTION (Side-by-side, 531pt total)
      {
        columns: [
          // Left: Amount in Words, Tax Summary Box & Payment Status
          {
            width: 260,
            stack: [
              amountInWordsText ? {
                margin: [0, 0, 0, 8],
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        stack: [
                          { text: 'INVOICE AMOUNT IN WORDS', style: 'boxHeading', margin: [0, 0, 0, 2] },
                          { text: amountInWordsText, fontSize: 8, bold: true, color: '#111827', lineHeight: 1.2 },
                          ...(isReceipt && Number(paymentStatus?.settlementDiscount) > 0 ? [
                            { text: `Agreed Settlement: ${formatCurrency(paymentStatus.paidAmount || 0)} (Full & Final)`, fontSize: 7.5, color: '#B45309', bold: true, margin: [0, 2, 0, 0] }
                          ] : [])
                        ]
                      }
                    ]
                  ]
                },
                layout: {
                  fillColor: '#F8FAFC',
                  hLineWidth: () => 0.75,
                  vLineWidth: () => 0.75,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0',
                  paddingTop: () => 5,
                  paddingBottom: () => 5,
                  paddingLeft: () => 8,
                  paddingRight: () => 8
                }
              } : null,

              (summary.taxTotal > 0) ? {
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [
                      { text: 'TAX BREAKDOWN', colSpan: 2, style: 'boxHeading' },
                      {}
                    ],
                    ...(Number(summary.cgstTotal) > 0 ? [[
                      { text: 'Central GST (CGST)', style: 'taxBreakupLabel' },
                      { text: formatCurrency(summary.cgstTotal), style: 'taxBreakupValue' }
                    ]] : []),
                    ...(Number(summary.sgstTotal) > 0 ? [[
                      { text: 'State GST (SGST)', style: 'taxBreakupLabel' },
                      { text: formatCurrency(summary.sgstTotal), style: 'taxBreakupValue' }
                    ]] : []),
                    ...(Number(summary.igstTotal) > 0 ? [[
                      { text: 'Integrated GST (IGST)', style: 'taxBreakupLabel' },
                      { text: formatCurrency(summary.igstTotal), style: 'taxBreakupValue' }
                    ]] : []),
                    [
                      { text: 'Total Tax Amount', bold: true, fontSize: 8.5, color: '#111827', margin: [0, 4, 0, 2] },
                      { text: formatCurrency(summary.taxTotal), bold: true, fontSize: 8.5, alignment: 'right', margin: [0, 4, 0, 2] }
                    ]
                  ]
                },
                layout: {
                  fillColor: '#F8FAFC',
                  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length) ? 0.75 : 0.5,
                  vLineWidth: () => 0.75,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0',
                  paddingTop: () => 4,
                  paddingBottom: () => 4,
                  paddingLeft: () => 8,
                  paddingRight: () => 8
                }
              } : { text: '' },

              // Payment Status card - ONLY display if isReceipt and actual payment/settlement exists
              (isReceipt && paymentStatus && (Number(paymentStatus.paidAmount) > 0 || Number(paymentStatus.settlementDiscount) > 0 || paymentStatus.isSettled)) ? {
                margin: [0, 8, 0, 0],
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [
                      { text: paymentStatus.isSettled ? 'PAYMENT STATUS (SETTLED)' : 'PAYMENT STATUS', colSpan: 2, style: 'boxHeading' },
                      {}
                    ],
                    [
                      { text: 'Amount Paid', style: 'taxBreakupLabel' },
                      { text: formatCurrency(paymentStatus.paidAmount || 0), style: 'taxBreakupValue', color: '#047857', bold: true }
                    ],
                    ...(Number(paymentStatus.settlementDiscount) > 0 ? [[
                      { text: 'Agreed Waiver / Discount', style: 'taxBreakupLabel', color: '#B45309' },
                      { text: formatCurrency(paymentStatus.settlementDiscount), style: 'taxBreakupValue', color: '#B45309', bold: true }
                    ]] : []),
                    [
                      { text: 'Balance Due', style: 'taxBreakupLabel', bold: true },
                      {
                        text: formatCurrency(paymentStatus.balanceDue || 0),
                        style: 'taxBreakupValue',
                        color: Number(paymentStatus.balanceDue) > 0 ? '#B91C1C' : '#047857',
                        bold: true
                      }
                    ]
                  ]
                },
                layout: {
                  fillColor: '#F8FAFC',
                  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.75 : 0.5,
                  vLineWidth: () => 0.75,
                  hLineColor: () => '#E2E8F0',
                  vLineColor: () => '#E2E8F0',
                  paddingTop: () => 3,
                  paddingBottom: () => 3,
                  paddingLeft: () => 8,
                  paddingRight: () => 8
                }
              } : null
            ].filter(Boolean)
          },

          // Center gap
          { width: 15, text: '' },

          // Right: Financial Summary Totals
          {
            width: 256,
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  { text: 'Subtotal', style: 'totalsLabel' },
                  { text: formatCurrency(summary.subTotal), style: 'totalsValue' }
                ],
                ...(summary.discountTotal > 0 ? [[
                  { text: 'Discount', style: 'totalsLabel', color: '#DC2626' },
                  { text: `-${formatCurrency(summary.discountTotal)}`, style: 'totalsValue', color: '#DC2626' }
                ]] : []),
                [
                  { text: 'Taxable Amount', style: 'totalsLabel' },
                  { text: formatCurrency(summary.taxableTotal), style: 'totalsValue' }
                ],
                [
                  { text: 'Total GST', style: 'totalsLabel' },
                  { text: formatCurrency(summary.taxTotal), style: 'totalsValue' }
                ],
                [
                  { text: 'GRAND TOTAL', bold: true, fontSize: 10.5, color: '#0F172A', margin: [0, 8, 0, 8] },
                  { text: formatCurrency(summary.grandTotal), bold: true, fontSize: 12.5, color: '#0F172A', alignment: 'right', margin: [0, 8, 0, 8] }
                ],
                ...(isReceipt && paymentStatus && (Number(paymentStatus.paidAmount) > 0 || Number(paymentStatus.settlementDiscount) > 0) ? [
                  [
                    { text: 'Amount Paid', style: 'totalsLabel', color: '#047857' },
                    { text: formatCurrency(paymentStatus.paidAmount || 0), style: 'totalsValue', color: '#047857', bold: true }
                  ],
                  ...(Number(paymentStatus.settlementDiscount) > 0 ? [
                    [
                      { text: 'Agreed Waiver / Discount', style: 'totalsLabel', color: '#B45309' },
                      { text: `-${formatCurrency(paymentStatus.settlementDiscount)}`, style: 'totalsValue', color: '#B45309', bold: true }
                    ]
                  ] : []),
                  [
                    { text: 'BALANCE DUE', bold: true, fontSize: 9.5, color: Number(paymentStatus.balanceDue) > 0 ? '#B91C1C' : '#047857', margin: [0, 4, 0, 4] },
                    { text: formatCurrency(paymentStatus.balanceDue || 0), bold: true, fontSize: 11, color: Number(paymentStatus.balanceDue) > 0 ? '#B91C1C' : '#047857', alignment: 'right', margin: [0, 4, 0, 4] }
                  ]
                ] : [])
              ]
            },
            layout: {
              fillColor: () => '#F8FAFC',
              hLineWidth: function (i, node) {
                const prevRow = node.table.body[i - 1];
                const currentRow = node.table.body[i];
                if ((currentRow && currentRow[0] && currentRow[0].text === 'GRAND TOTAL') ||
                    (prevRow && prevRow[0] && prevRow[0].text === 'GRAND TOTAL')) {
                  return 1.5;
                }
                if (i === 0 || i === node.table.body.length) return 0.75;
                return 0.5;
              },
              vLineWidth: () => 0.75,
              hLineColor: function (i, node) {
                const prevRow = node.table.body[i - 1];
                const currentRow = node.table.body[i];
                if ((currentRow && currentRow[0] && currentRow[0].text === 'GRAND TOTAL') ||
                    (prevRow && prevRow[0] && prevRow[0].text === 'GRAND TOTAL')) {
                  return '#0F172A';
                }
                return '#E2E8F0';
              },
              vLineColor: () => '#E2E8F0',
              paddingTop: () => 3.5,
              paddingBottom: () => 3.5,
              paddingLeft: () => 8,
              paddingRight: () => 8
            }
          }
        ]
      },

      // 5B. PAYMENT & SETTLEMENT HISTORY (Receipt only, matches reference UI)
      ...(isReceipt && payments && payments.length > 0 ? [
        ...(isMultiPageReceipt ? [
          {
            pageBreak: 'before',
            columns: [
              {
                stack: [
                  { text: (businessSnapshot?.name || '').toUpperCase(), fontSize: 13, bold: true, color: '#111827' },
                  { text: 'PAYMENT RECEIPT & SETTLEMENT RECORD', fontSize: 7.5, bold: true, color: '#6B7280', margin: [0, 1, 0, 6] }
                ]
              },
              {
                stack: [
                  { text: `Invoice #${invoice.invoiceNumber || '0000'}`, fontSize: 8.5, bold: true, color: '#111827', alignment: 'right' },
                  { text: 'Page 2 of 2', fontSize: 7.5, color: '#9CA3AF', alignment: 'right', margin: [0, 1, 0, 0] }
                ]
              }
            ]
          },
          {
            margin: [0, 4, 0, 10],
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 0.75, lineColor: '#E2E8F0' }]
          }
        ] : []),
        {
          margin: [0, 6, 0, 0],
          unbreakable: true,
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { text: 'PAYMENT & SETTLEMENT HISTORY', fontSize: 7.5, bold: true, color: '#6B7280', characterSpacing: 0.5, margin: [0, 0, 0, 2] },
                    { text: 'Record payments, round-offs, or negotiated verbal discounts to close invoices.', fontSize: 7, color: '#9CA3AF', margin: [0, 0, 0, 5] },
                    {
                      table: {
                        widths: [70, 75, '*', 70],
                        body: payments.map(p => [
                          { text: formatCurrency(p.amount), bold: true, fontSize: 8, color: '#111827' },
                          { text: p.method || 'Payment', fontSize: 7.5, color: '#4B5563' },
                          {
                            text: [
                              ...(p.isFinalSettlement && Number(p.settlementDiscount) > 0 ? [`Settlement Waiver: ${formatCurrency(p.settlementDiscount)} `] : []),
                              ...(p.referenceNumber ? [`Ref: ${p.referenceNumber} `] : []),
                              ...(p.notes ? [`“${p.notes}”`] : [])
                            ].join(''),
                            fontSize: 7,
                            color: '#6B7280',
                            italics: true
                          },
                          { text: formatDate(p.paymentDate || p.createdAt), fontSize: 7.5, color: '#6B7280', alignment: 'right' }
                        ])
                      },
                      layout: {
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.5,
                        vLineWidth: () => 0,
                        hLineColor: () => '#E2E8F0',
                        paddingTop: () => 2.5,
                        paddingBottom: () => 2.5,
                        paddingLeft: () => 0,
                        paddingRight: () => 0
                      }
                    }
                  ]
                }
              ]
            ]
          },
          layout: {
            fillColor: '#F8FAFC',
            hLineWidth: () => 0.75,
            vLineWidth: () => 0.75,
            hLineColor: () => '#E2E8F0',
            vLineColor: () => '#E2E8F0',
            paddingTop: () => 5,
            paddingBottom: () => 5,
            paddingLeft: () => 8,
            paddingRight: () => 8
          }
        }
      ] : []),

      // 6. NOTES, TERMS & AUTHORIZED SIGNATORY
      {
        margin: [0, 20, 0, 0],
        unbreakable: true,
        columns: [
          {
            width: 310,
            stack: [
              invoice.notes ? {
                stack: [
                  { text: 'NOTES', style: 'boxHeading' },
                  { text: invoice.notes, fontSize: 8, color: '#4B5563', margin: [0, 2, 0, 6] }
                ]
              } : null,
              invoice.terms ? {
                stack: [
                  { text: 'TERMS & CONDITIONS', style: 'boxHeading' },
                  { text: invoice.terms, fontSize: 8, color: '#4B5563', margin: [0, 2, 0, 6] }
                ]
              } : null,
              {
                margin: [0, 4, 0, 0],
                table: {
                  widths: [40, '*'],
                  body: [
                    [
                      { qr: `https://frontend-232i.onrender.com/verify?code=${verificationCode}`, fit: 36, alignment: 'center', margin: [0, 1, 0, 0] },
                      {
                        stack: [
                          { text: 'AUTHENTICITY & VERIFICATION', fontSize: 6.5, bold: true, color: '#047857' },
                          { text: `Certified Computer-Generated Tax Invoice. Scan QR or verify online with ID: ${verificationCode}.`, fontSize: 6.5, color: '#4B5563', margin: [0, 1, 0, 0] }
                        ]
                      }
                    ]
                  ]
                },
                layout: {
                  fillColor: () => '#F0FDF4',
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#86EFAC',
                  vLineColor: () => '#86EFAC',
                  paddingTop: () => 4,
                  paddingBottom: () => 4,
                  paddingLeft: () => 6,
                  paddingRight: () => 6
                }
              }
            ].filter(Boolean)
          },
          { width: 15, text: '' },
          {
            width: 206,
            stack: [
              { text: `For ${businessSnapshot.name}`, bold: true, fontSize: 8.5, alignment: 'right', color: '#111827' },
              signatureImg ? {
                image: signatureImg,
                width: 90,
                alignment: 'right',
                margin: [0, 4, 0, 2]
              } : {
                text: signerName,
                italics: true,
                bold: true,
                fontSize: 12,
                color: '#1E3A8A',
                alignment: 'right',
                margin: [0, 6, 0, 4]
              },
              {
                canvas: [{ type: 'line', x1: 50, y1: 0, x2: 206, y2: 0, lineWidth: 0.75, lineColor: '#9CA3AF' }]
              },
              { text: signerName, bold: true, fontSize: 8, alignment: 'right', color: '#111827', margin: [0, 2, 0, 0] },
              { text: signerDesignation, fontSize: 7.5, alignment: 'right', color: '#6B7280', margin: [0, 0, 0, 2] },
              { text: '✔ Digitally Signed & Authenticated', fontSize: 6.5, bold: true, color: '#059669', alignment: 'right' }
            ]
          }
        ]
      }
    ],

    footer: function (currentPage, pageCount) {
      return {
        margin: [36, 12, 36, 0],
        columns: [
          {
            text: `Certified Tax Invoice • Authenticated via BillFlow • Verification ID: ${verificationCode}`,
            fontSize: 7,
            color: '#6B7280'
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            fontSize: 7,
            color: '#6B7280',
            alignment: 'right'
          }
        ]
      };
    },

    styles: {
      businessTitle: {
        fontSize: 16,
        bold: true,
        color: '#111827',
        margin: [0, 0, 0, 3]
      },
      businessDetail: {
        fontSize: 8.5,
        color: '#4B5563',
        margin: [0, 1, 0, 1]
      },
      documentTitle: {
        fontSize: 22,
        bold: true,
        color: '#4F46E5',
        margin: [0, 0, 0, 2]
      },
      documentSubtitle: {
        fontSize: 7.5,
        bold: true,
        color: '#6B7280',
        letterSpacing: 0.5
      },
      metaLabel: {
        fontSize: 7,
        bold: true,
        color: '#6B7280',
        letterSpacing: 0.5,
        margin: [0, 0, 0, 2]
      },
      metaValue: {
        fontSize: 9,
        color: '#111827'
      },
      statusBadge: {
        fontSize: 8,
        bold: true,
        alignment: 'center',
        margin: [0, 1, 0, 0]
      },
      sectionHeading: {
        fontSize: 7.5,
        bold: true,
        color: '#6B7280',
        letterSpacing: 0.5,
        margin: [0, 0, 0, 3]
      },
      customerDetail: {
        fontSize: 8.5,
        color: '#4B5563',
        margin: [0, 1, 0, 1]
      },
      posLabel: {
        fontSize: 7,
        bold: true,
        color: '#5B21B6',
        letterSpacing: 0.5,
        margin: [0, 0, 0, 2]
      },
      tableHeader: {
        fontSize: 7.5,
        bold: true,
        color: '#374151'
      },
      tableCell: {
        fontSize: 8,
        color: '#1F2937'
      },
      boxHeading: {
        fontSize: 7.5,
        bold: true,
        color: '#4B5563',
        letterSpacing: 0.5,
        margin: [0, 0, 0, 3]
      },
      taxBreakupLabel: {
        fontSize: 8,
        color: '#4B5563'
      },
      taxBreakupValue: {
        fontSize: 8,
        alignment: 'right',
        color: '#111827'
      },
      totalsLabel: {
        fontSize: 8.5,
        color: '#4B5563'
      },
      totalsValue: {
        fontSize: 8.5,
        alignment: 'right',
        color: '#111827',
        bold: true
      }
    }
  };

  const pdfDoc = await printer.createPdfKitDocument(docDefinition);

  return pdfDoc;
};

module.exports = {
  generateInvoicePdf
};
