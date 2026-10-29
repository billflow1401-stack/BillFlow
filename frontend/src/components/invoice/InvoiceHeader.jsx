import React from 'react';
import { formatDate } from '../../utils/formatters';

const InvoiceHeader = ({ businessSnapshot, invoice = {}, showPaymentStatus = true }) => {
  if (!businessSnapshot) return null;

  const isB2B = invoice.billingMode === 'GST-Registered' || Boolean(invoice.customerSnapshot?.gstin);
  const pos = invoice.placeOfSupply || invoice.customerSnapshot?.placeOfSupply || invoice.customerSnapshot?.state || 'Same as Supplier';
  const posCode = invoice.placeOfSupplyStateCode || invoice.customerSnapshot?.placeOfSupplyStateCode;

  // Build formatted address
  const addressParts = [
    businessSnapshot.address,
    businessSnapshot.city,
    businessSnapshot.state,
    businessSnapshot.pinCode,
    businessSnapshot.country && businessSnapshot.country !== 'India' ? businessSnapshot.country : null
  ].filter(Boolean);
  const formattedAddress = addressParts.join(', ');

  // Invoice display number
  const invoiceNum = invoice.invoiceNumber
    ? `#${invoice.invoiceNumber}`
    : (invoice._id ? `#${invoice._id.slice(-6).toUpperCase()}` : '#0000');
  const invoiceDate = formatDate(invoice.date || invoice.createdAt || new Date());

  const displayOwnerName = businessSnapshot.ownerName || businessSnapshot.bankDetails?.accountName || '';

  return (
    <div className="border-b border-slate-200 pb-6 mb-6 print:pb-3 print:mb-3">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 print:flex-row print:justify-between print:gap-4">
        {/* Left Column: Business Branding & Contact Identity */}
        <div className="flex-1 max-w-xl">
          <div>
            <h1 className="text-2xl sm:text-3xl print:text-xl font-extrabold text-slate-900 tracking-tight">
              {businessSnapshot.name}
            </h1>
            {businessSnapshot.tagline && (
              <p className="text-xs sm:text-sm print:text-[10.5px] font-medium text-slate-500 italic mt-0.5">
                {businessSnapshot.tagline}
              </p>
            )}
          </div>

          {/* Business Contact List */}
          <div className="mt-3.5 print:mt-2 space-y-1 text-xs print:text-[10px] text-slate-600">
            {(businessSnapshot.phone || displayOwnerName) && (
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div className="flex flex-wrap items-center gap-x-2">
                  {displayOwnerName && (
                    <span className="font-semibold text-slate-900">{displayOwnerName}</span>
                  )}
                  {businessSnapshot.phone && (
                    <span className="text-slate-700">{businessSnapshot.phone}</span>
                  )}
                  {businessSnapshot.alternatePhone && (
                    <span className="text-slate-500">/ {businessSnapshot.alternatePhone}</span>
                  )}
                </div>
              </div>
            )}

            {formattedAddress && (
              <div className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="leading-relaxed">{formattedAddress}</span>
              </div>
            )}

            {businessSnapshot.email && (
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-700">{businessSnapshot.email}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 pt-1 font-mono text-[11px] print:text-[9.5px]">
              {businessSnapshot.gstin && (
                <div>
                  <span className="font-sans font-semibold text-slate-500">GSTIN: </span>
                  <span className="font-bold text-slate-900">{businessSnapshot.gstin}</span>
                </div>
              )}
              {businessSnapshot.pan && (
                <div>
                  <span className="font-sans font-semibold text-slate-500">PAN: </span>
                  <span className="font-bold text-slate-900">{businessSnapshot.pan}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Typographic Document Header & Meta Grid */}
        <div className="w-full sm:w-auto text-left sm:text-right print:text-right shrink-0">
          <h2 className="text-2xl sm:text-3xl print:text-2xl font-black text-slate-900 tracking-tight uppercase">
            {invoice.status === 'Draft' ? 'DRAFT INVOICE' : (isB2B ? 'TAX INVOICE' : 'INVOICE')}
          </h2>
          <p className="text-[11px] print:text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 mb-3 print:mb-1.5">
            {isB2B ? 'GST Tax Invoice (B2B)' : 'Original for Recipient'}
          </p>

          {/* Clean Key-Value Meta Rows */}
          <div className="inline-block text-left text-xs print:text-[10px] space-y-1 bg-slate-50 print:bg-transparent p-3 print:p-0 rounded-xl border border-slate-200/70 print:border-none min-w-[200px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 font-semibold">Invoice No:</span>
              <span className="font-mono font-bold text-slate-900">{invoiceNum}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 font-semibold">Invoice Date:</span>
              <span className="text-slate-800 font-medium">{invoiceDate}</span>
            </div>
            {pos && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-semibold">Place of Supply:</span>
                <span className="text-slate-800 font-medium">{pos}{posCode ? ` (${posCode})` : ''}</span>
              </div>
            )}
            {showPaymentStatus && (
              <div className="flex justify-between gap-4 items-center pt-1 mt-1 border-t border-slate-200 print:border-none">
                <span className="text-slate-500 font-semibold">Status:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                  ${invoice.status === 'Draft' ? 'bg-slate-200/80 text-slate-800' : ''}
                  ${invoice.status === 'Unpaid' ? 'bg-blue-100 text-blue-800' : ''}
                  ${invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : ''}
                  ${invoice.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' : ''}
                  ${invoice.status === 'Overdue' ? 'bg-rose-100 text-rose-800' : ''}
                `}>
                  {invoice.status || 'UNPAID'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceHeader;
