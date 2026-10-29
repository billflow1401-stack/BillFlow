import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import api from '../api/axios';
import InvoiceHeader from '../components/invoice/InvoiceHeader';
import BillToSection from '../components/invoice/BillToSection';
import InvoiceItemsTable from '../components/invoice/InvoiceItemsTable';
import InvoiceTotals from '../components/invoice/InvoiceTotals';
import InvoicePaymentHistory from '../components/invoice/InvoicePaymentHistory';
import DigitalSignatureSeal from '../components/invoice/DigitalSignatureSeal';
import InvoiceAuditTrail from '../components/invoice/InvoiceAuditTrail';
import PaymentSection from '../components/invoice/PaymentSection';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

const InvoiceViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const invoiceSheetRef = useRef(null);
  const [invoice, setInvoice] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportMode, setExportMode] = useState(null); // null | 'clean' | 'receipt' | 'receipt-p1' | 'receipt-p2'
  const [downloadingType, setDownloadingType] = useState(null); // null | 'clean' | 'receipt'

  const fetchInvoice = async () => {
    try {
      const [invoiceRes, profileRes, paymentsRes] = await Promise.allSettled([
        api.get(`/invoices/${id}`),
        api.get('/business/profile'),
        api.get(`/invoices/${id}/payments`)
      ]);

      if (invoiceRes.status === 'fulfilled') {
        setInvoice(invoiceRes.value.data.data.invoice);
      } else {
        throw invoiceRes.reason;
      }

      if (profileRes.status === 'fulfilled' && profileRes.value?.data?.data?.business) {
        setBusinessProfile(profileRes.value.data.data.business);
      }

      if (paymentsRes.status === 'fulfilled' && paymentsRes.value?.data?.data?.payments) {
        setPayments(paymentsRes.value.data.data.payments);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to load invoice. It may not exist or you do not have permission.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-rose-50 border border-rose-200/80 p-6 rounded-2xl text-center">
          <svg className="w-10 h-10 text-rose-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-slate-900 font-semibold text-base">{error || 'Invoice not found'}</p>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const downloadPdfFromBackend = async (type = 'clean') => {
    const response = await api.get(`/invoices/${id}/pdf?type=${type}`, {
      responseType: 'blob'
    });

    const rawData = response.data;
    if (rawData.type === 'application/json') {
      const text = await rawData.text();
      const errorData = JSON.parse(text);
      throw new Error(errorData.error || errorData.message || 'Failed to generate PDF');
    }

    const prefix = type === 'receipt' ? 'Receipt' : 'Invoice';
    let filename = `${prefix}-${invoice.invoiceNumber || id}.pdf`;
    const disposition = response.headers?.['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf';
    }

    const blob = new Blob([rawData], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 1000);
  };

  const hasPaymentsRecorded = (payments && payments.length > 0) ||
    Number(invoice.paymentStatus?.paidAmount) > 0 ||
    Number(invoice.paymentStatus?.settlementDiscount) > 0 ||
    ['Paid', 'Partially Paid'].includes(invoice.status);

  const handleDownloadPdf = async (type = 'clean') => {
    try {
      setDownloadingType(type);

      const isReceipt = type === 'receipt';
      const hasMultiplePayments = payments && payments.length > 1;
      const hasManyItems = invoice.items && invoice.items.length > 2;

      // Multi-page receipt: When payments are made multiple times or items + payments exceed single page space
      const isMultiPageReceipt = isReceipt && (
        hasMultiplePayments ||
        (payments && payments.length > 0 && hasManyItems) ||
        (invoice.items && invoice.items.length > 5)
      );

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 5; // 5mm clean page margin
      const printWidth = pageWidth - (margin * 2);

      if (isMultiPageReceipt) {
        // --- PAGE 1: FULL BILL DETAILS & TOTALS ---
        setExportMode('receipt-p1');
        await new Promise((resolve) => setTimeout(resolve, 100));

        const elementP1 = invoiceSheetRef.current;
        if (!elementP1) throw new Error('Invoice sheet element not found');

        const imgDataP1 = await toPng(elementP1, {
          quality: 1,
          pixelRatio: 2.5,
          backgroundColor: '#ffffff'
        });

        const imgPropsP1 = pdf.getImageProperties(imgDataP1);
        const printHeightP1 = (imgPropsP1.height * printWidth) / imgPropsP1.width;
        pdf.addImage(imgDataP1, 'PNG', margin, margin, printWidth, printHeightP1, undefined, 'FAST');

        // --- PAGE 2: WHOLE PAYMENT HISTORY & SIGNATURE ---
        pdf.addPage();
        setExportMode('receipt-p2');
        await new Promise((resolve) => setTimeout(resolve, 100));

        const elementP2 = invoiceSheetRef.current;
        if (!elementP2) throw new Error('Invoice sheet element not found');

        const imgDataP2 = await toPng(elementP2, {
          quality: 1,
          pixelRatio: 2.5,
          backgroundColor: '#ffffff'
        });

        const imgPropsP2 = pdf.getImageProperties(imgDataP2);
        const printHeightP2 = (imgPropsP2.height * printWidth) / imgPropsP2.width;
        pdf.addImage(imgDataP2, 'PNG', margin, margin, printWidth, printHeightP2, undefined, 'FAST');

        const filename = `Receipt-${invoice.invoiceNumber || id}.pdf`;
        pdf.save(filename);
        return;
      }

      // --- SINGLE PAGE EXPORT (Clean invoice OR 1-page compact receipt) ---
      setExportMode(type);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const element = invoiceSheetRef.current;
      if (element) {
        const imgData = await toPng(element, {
          quality: 1,
          pixelRatio: 2.5,
          backgroundColor: '#ffffff'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const printHeight = (imgProps.height * printWidth) / imgProps.width;

        let heightLeft = printHeight;
        let position = margin;

        pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - margin * 2);

        while (heightLeft > 0) {
          position = heightLeft - printHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight, undefined, 'FAST');
          heightLeft -= (pageHeight - margin * 2);
        }

        const prefix = isReceipt ? 'Receipt' : 'Invoice';
        const filename = `${prefix}-${invoice.invoiceNumber || id}.pdf`;
        pdf.save(filename);
        return;
      }

      await downloadPdfFromBackend(type);
    } catch (err) {
      console.warn('Direct DOM PDF export failed, falling back to server PDF:', err);
      try {
        await downloadPdfFromBackend(type);
      } catch (fallbackErr) {
        console.error('Error downloading PDF:', fallbackErr);
        alert('Failed to download PDF. Please try again.');
      }
    } finally {
      setExportMode(null);
      setDownloadingType(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-16 min-h-screen bg-slate-50/70 print:bg-white print:p-0 print:m-0 max-w-5xl mx-auto print:max-w-none print:w-full antialiased">
      {/* Action Bar - Hidden during print */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/invoices')}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            }
          >
            Back to Invoices
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <span className="text-xs text-slate-500 block">Viewing Invoice</span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {invoice.invoiceNumber || 'Draft Invoice'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {invoice.status === 'Draft' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/invoices/new?edit=${invoice._id}`)}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
            >
              Edit Draft
            </Button>
          )}

          {/* Button 1: Download Clean Customer Invoice */}
          <Button
            id="download-pdf-btn"
            variant="success"
            size="sm"
            onClick={() => handleDownloadPdf('clean')}
            disabled={Boolean(downloadingType)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          >
            {downloadingType === 'clean' ? 'Generating Invoice...' : 'Download PDF'}
          </Button>

          {/* Button 2: Download Payment Receipt with History (Visible after customer pays partially or in full) */}
          {hasPaymentsRecorded && (
            <Button
              id="download-receipt-btn"
              variant="primary"
              size="sm"
              onClick={() => handleDownloadPdf('receipt')}
              disabled={Boolean(downloadingType)}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z" />
                </svg>
              }
            >
              {downloadingType === 'receipt' ? 'Generating Receipt...' : 'Download Payment Receipt'}
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Document Paper */}
      <div className="bg-white shadow-xs rounded-2xl overflow-hidden border border-slate-200/90 print:shadow-none print:rounded-none print:border-none print:overflow-visible print:w-full">
        {/* Printable/Exportable Invoice Sheet */}
        <div ref={invoiceSheetRef} id="invoice-sheet" className="p-8 sm:p-12 print:p-0 print:m-0 bg-white">
          {(() => {
            const snap = invoice.businessSnapshot || {};
            const biz = businessProfile || {};
            const resolvedBankDetails = {
              bankName: snap.bankDetails?.bankName || biz.bankDetails?.bankName || '',
              accountNumber: snap.bankDetails?.accountNumber || biz.bankDetails?.accountNumber || '',
              ifsc: snap.bankDetails?.ifsc || biz.bankDetails?.ifsc || '',
              branchName: snap.bankDetails?.branchName || biz.bankDetails?.branchName || '',
              accountName: snap.bankDetails?.accountName || biz.bankDetails?.accountName || ''
            };

            const resolvedBusinessSnapshot = {
              ...biz,
              ...snap,
              name: snap.name || biz.name || '',
              ownerName: snap.ownerName || biz.ownerName || resolvedBankDetails.accountName || '',
              tagline: snap.tagline || biz.tagline || '',
              phone: snap.phone || biz.phone || '',
              alternatePhone: snap.alternatePhone || biz.alternatePhone || '',
              email: snap.email || biz.email || '',
              website: snap.website || biz.website || '',
              address: snap.address || biz.address || '',
              city: snap.city || biz.city || '',
              state: snap.state || biz.state || '',
              pinCode: snap.pinCode || biz.pinCode || '',
              country: snap.country || biz.country || 'India',
              gstin: snap.gstin || biz.gstin || '',
              pan: snap.pan || biz.pan || '',
              bankDetails: resolvedBankDetails,
              signature: snap.signature || biz.signature || {
                url: '',
                signerName: snap.ownerName || biz.ownerName || '',
                designation: 'Authorized Signatory'
              },
              seal: snap.seal || biz.seal || { url: '' }
            };

            // Render Mode logic:
            // 1. exportMode === 'receipt-p2': Clean page 2 with whole payment history and signature
            if (exportMode === 'receipt-p2') {
              return (
                <div className="space-y-6">
                  {/* Page 2 Elegant Minimal Header */}
                  <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-end">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">{resolvedBusinessSnapshot.name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Payment & Settlement Receipt</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Invoice Reference</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">#{invoice.invoiceNumber || '0000'}</span>
                      <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">Page 2 of 2</span>
                    </div>
                  </div>

                  {/* Complete Payment & Settlement History Card */}
                  <InvoicePaymentHistory payments={payments} />

                  {/* Notes & Terms if present */}
                  {(invoice.notes || invoice.terms) && (
                    <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
                      {invoice.notes && (
                        <div>
                          <h4 className="font-bold text-slate-900 mb-1 uppercase tracking-wider text-[11px]">Notes</h4>
                          <p className="whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
                        </div>
                      )}
                      {invoice.terms && (
                        <div>
                          <h4 className="font-bold text-slate-900 mb-1 uppercase tracking-wider text-[11px]">Terms & Conditions</h4>
                          <p className="whitespace-pre-wrap leading-relaxed">{invoice.terms}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Complete Document Digital Signature & Verification Seal */}
                  <DigitalSignatureSeal
                    businessSnapshot={resolvedBusinessSnapshot}
                    invoice={invoice}
                  />
                </div>
              );
            }

            // 2. exportMode === 'receipt-p1': Page 1 of multi-page receipt (Invoice details, totals, without payment history & signatory)
            if (exportMode === 'receipt-p1') {
              return (
                <>
                  <InvoiceHeader
                    businessSnapshot={resolvedBusinessSnapshot}
                    invoice={invoice}
                    showPaymentStatus={true}
                  />
                  <BillToSection
                    customerSnapshot={invoice.customerSnapshot}
                    invoice={invoice}
                    businessSnapshot={resolvedBusinessSnapshot}
                    exportMode={exportMode}
                    isExporting={Boolean(exportMode)}
                  />
                  <InvoiceItemsTable items={invoice.items} />
                  <InvoiceTotals
                    summary={invoice.summary}
                    paymentStatus={invoice.paymentStatus}
                    showPaymentBreakdown={true}
                  />

                  {/* Multi-page Receipt Transition Footer banner */}
                  <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Tax Invoice & Settlement Overview</span>
                      <span>•</span>
                      <span>Invoice #{invoice.invoiceNumber || '0000'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 text-xs">
                      <span>Payment & Settlement History on Page 2</span>
                      <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="text-[10px] text-indigo-500 ml-1">(Page 1 of 2)</span>
                    </div>
                  </div>
                </>
              );
            }

            // 3. Normal Screen View (exportMode === null), Single-page Receipt (exportMode === 'receipt'), or Clean Invoice (exportMode === 'clean')
            const isCleanExport = exportMode === 'clean';
            const isSinglePageReceipt = exportMode === 'receipt';

            // Show payment status in header for normal screen view and receipt exports
            const showPaymentStatus = !isCleanExport;
            // Show payment breakdown in totals for normal screen view and receipt exports
            const showPaymentBreakdown = !isCleanExport;
            // Show embedded payment history inside sheet only during single-page receipt export
            const showPaymentHistory = isSinglePageReceipt;

            return (
              <>
                <InvoiceHeader
                  businessSnapshot={resolvedBusinessSnapshot}
                  invoice={invoice}
                  showPaymentStatus={showPaymentStatus}
                />
                <BillToSection
                  customerSnapshot={invoice.customerSnapshot}
                  invoice={invoice}
                  businessSnapshot={resolvedBusinessSnapshot}
                  exportMode={exportMode}
                  isExporting={Boolean(exportMode)}
                />
                <InvoiceItemsTable items={invoice.items} />
                <InvoiceTotals
                  summary={invoice.summary}
                  paymentStatus={invoice.paymentStatus}
                  showPaymentBreakdown={showPaymentBreakdown}
                />

                {/* Embedded Payment History (Only on single-page receipt export) */}
                {showPaymentHistory && payments && payments.length > 0 && (
                  <InvoicePaymentHistory payments={payments} />
                )}

                {/* Notes and Terms */}
                {(invoice.notes || invoice.terms) && (
                  <div className="mt-6 print:mt-3 border-t border-slate-200 pt-4 print:pt-2 grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6 print:gap-4 text-xs print:text-[10px] text-slate-600 print:break-inside-avoid print:page-break-inside-avoid">
                    {invoice.notes && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1 uppercase tracking-wider text-[11px] print:text-[9.5px]">Notes</h4>
                        <p className="whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
                      </div>
                    )}
                    {invoice.terms && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1 uppercase tracking-wider text-[11px] print:text-[9.5px]">Terms & Conditions</h4>
                        <p className="whitespace-pre-wrap leading-relaxed">{invoice.terms}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Complete Document Digital Signature & Verification Seal */}
                <DigitalSignatureSeal
                  businessSnapshot={resolvedBusinessSnapshot}
                  invoice={invoice}
                />
              </>
            );
          })()}
        </div>

        {/* Document Authenticity & Audit Ledger (Visible on-screen, excluded from PDF/print) */}
        <div className="px-8 sm:px-12 pb-4 print:hidden">
          <InvoiceAuditTrail invoice={invoice} payments={payments} />
        </div>

        {/* Payment Section (Separated below the bill sheet for live recording and viewing on screen) */}
        <div className="p-8 sm:p-12 border-t border-slate-200/80 bg-slate-50/40 print:hidden">
          <PaymentSection invoice={invoice} onPaymentSuccess={fetchInvoice} />
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewPage;
