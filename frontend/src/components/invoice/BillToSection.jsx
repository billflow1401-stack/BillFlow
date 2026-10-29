import React from 'react';

const BillToSection = ({ customerSnapshot, invoice, businessSnapshot, exportMode, isExporting }) => {
  const customer = customerSnapshot || invoice?.customerSnapshot;
  const isRegistered = customer?.billingMode === 'GST-Registered' || Boolean(customer?.gstin);
  const bank = businessSnapshot?.bankDetails || {};
  const hasBank = Boolean(bank.accountNumber || bank.ifsc || bank.bankName || bank.accountName || businessSnapshot?.pan);

  // Check if phone should be displayed on the generated bill / PDF (default is hidden/unchecked)
  const shouldShowPhoneOnBill = Boolean(customer?.showPhoneOnInvoice || invoice?.showPhoneOnInvoice);
  const isExportActive = Boolean(exportMode || isExporting);

  const customerAddress = [
    customer?.billingAddress,
    customer?.city,
    customer?.state,
    customer?.pinCode,
    customer?.country && customer.country !== 'India' ? customer.country : null
  ].filter(Boolean).join(', ');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:grid-cols-2 print:gap-3 print:mb-3">
      {/* Left Column: Billed To / Recipient */}
      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 print:bg-white print:border print:border-slate-300 print:p-2.5 print:rounded-none">
        <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-200/70 print:border-slate-300">
          <span className="text-[11px] print:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
            {isRegistered ? 'Billed To (Registered Recipient)' : 'Billed To (Customer / Client)'}
          </span>
          <span className="text-[10px] print:text-[9px] font-medium text-slate-500">
            {invoice?.billingMode || 'General'}
          </span>
        </div>

        <div className="text-slate-900">
          <h3 className="font-bold text-base print:text-xs text-slate-900 leading-snug">
            {customer?.name || 'Walk-in / Counter Sale'}
          </h3>

          <div className="mt-1.5 space-y-1 text-xs print:text-[10px] text-slate-600">
            {customerAddress && (
              <p className="leading-relaxed">{customerAddress}</p>
            )}

            <div className="pt-1 space-y-0.5">
              {customer?.phone && (!isExportActive || shouldShowPhoneOnBill) && (
                <p className={!shouldShowPhoneOnBill ? 'print:hidden' : ''}>
                  <span className="font-medium text-slate-500">Phone: </span>
                  <span className="text-slate-800 font-medium">{customer.phone}</span>
                  {!shouldShowPhoneOnBill && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80 print:hidden">
                      🔒 Hidden on Bill & Receipt
                    </span>
                  )}
                </p>
              )}
              {customer?.email && (
                <p>
                  <span className="font-medium text-slate-500">Email: </span>
                  <span className="text-slate-800">{customer.email}</span>
                </p>
              )}
              {isRegistered && customer?.gstin && (
                <p className="font-mono">
                  <span className="font-sans font-medium text-slate-500">GSTIN: </span>
                  <span className="font-bold text-slate-900">{customer.gstin}</span>
                </p>
              )}
              {isRegistered && customer?.pan && (
                <p className="font-mono">
                  <span className="font-sans font-medium text-slate-500">PAN: </span>
                  <span className="font-bold text-slate-900">{customer.pan}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Bank & Settlement Details */}
      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 print:bg-white print:border print:border-slate-300 print:p-2.5 print:rounded-none">
        <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-200/70 print:border-slate-300">
          <span className="text-[11px] print:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>Bank & Payment Details</span>
          </span>
          <span className="text-[10px] print:text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 print:border-none print:bg-transparent">
            NEFT / RTGS / IMPS
          </span>
        </div>

        {hasBank ? (
          <div className="space-y-1.5 text-xs print:text-[10px]">
            {bank.bankName && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Bank Name:</span>
                <span className="font-bold text-slate-900 text-right">{bank.bankName}</span>
              </div>
            )}
            {bank.accountNumber && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Account No:</span>
                <span className="font-mono font-bold text-slate-900 text-right">{bank.accountNumber}</span>
              </div>
            )}
            {bank.ifsc && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">IFSC Code:</span>
                <span className="font-mono font-bold text-slate-900 text-right">{bank.ifsc}</span>
              </div>
            )}
            {(bank.accountName || businessSnapshot?.ownerName) && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Beneficiary:</span>
                <span className="font-semibold text-slate-800 text-right">{bank.accountName || businessSnapshot?.ownerName}</span>
              </div>
            )}
            {bank.branchName && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-medium">Branch:</span>
                <span className="text-slate-700 text-right">{bank.branchName}</span>
              </div>
            )}
            {businessSnapshot?.pan && (
              <div className="flex justify-between gap-2 pt-0.5 border-t border-slate-200/60 print:border-none">
                <span className="text-slate-500 font-medium">PAN Number:</span>
                <span className="font-mono font-bold text-slate-900 text-right">{businessSnapshot.pan}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic mt-2">No bank settlement details specified.</p>
        )}
      </div>
    </div>
  );
};

export default BillToSection;
