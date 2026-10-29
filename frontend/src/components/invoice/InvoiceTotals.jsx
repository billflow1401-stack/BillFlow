import React from 'react';
import { formatCurrency, numberToIndianWords } from '../../utils/formatters';

const InvoiceTotals = ({ summary, paymentStatus, showPaymentBreakdown = true }) => {
  if (!summary) return null;

  const words = numberToIndianWords(summary.grandTotal);
  const hasSettlement = paymentStatus && Number(paymentStatus.settlementDiscount) > 0;
  const hasPayment = paymentStatus && (Number(paymentStatus.paidAmount) > 0 || hasSettlement);

  return (
    <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6 print:flex-row print:justify-between print:items-start print:gap-4 print:mb-3 print:break-inside-avoid print:page-break-inside-avoid">
      {/* Left Column: Amount in Words & Tax Summary Breakup */}
      <div className="w-full md:w-1/2 print:w-[50%] space-y-3 print:space-y-2">
        {/* Amount in Words */}
        {words && (
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 print:bg-transparent print:border print:border-slate-300 print:p-2 print:rounded-none">
            <p className="text-[10px] print:text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Invoice Amount in Words
            </p>
            <p className="text-xs print:text-[10px] font-semibold text-slate-800 leading-snug">
              {words}
            </p>
            {showPaymentBreakdown && hasSettlement && (
              <p className="mt-1 text-[11px] text-amber-700 font-medium">
                Agreed Settlement: {formatCurrency(paymentStatus.paidAmount || 0)} (Full & Final)
              </p>
            )}
          </div>
        )}

        {/* GST Tax Breakdown */}
        {summary.taxTotal > 0 && (
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 print:bg-transparent print:border print:border-slate-300 print:p-2 print:rounded-none">
            <h4 className="text-[10px] print:text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              GST Tax Breakdown
            </h4>
            <div className="space-y-1.5 text-xs print:text-[9.5px] text-slate-600">
              {Number(summary.cgstTotal) > 0 && (
                <div className="flex justify-between">
                  <span>Central GST (CGST):</span>
                  <span className="font-semibold text-slate-900 font-mono">{formatCurrency(summary.cgstTotal)}</span>
                </div>
              )}
              {Number(summary.sgstTotal) > 0 && (
                <div className="flex justify-between">
                  <span>State GST (SGST):</span>
                  <span className="font-semibold text-slate-900 font-mono">{formatCurrency(summary.sgstTotal)}</span>
                </div>
              )}
              {Number(summary.igstTotal) > 0 && (
                <div className="flex justify-between">
                  <span>Integrated GST (IGST):</span>
                  <span className="font-semibold text-slate-900 font-mono">{formatCurrency(summary.igstTotal)}</span>
                </div>
              )}
              <div className="pt-1 mt-1 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Total GST Amount:</span>
                <span className="font-mono">{formatCurrency(summary.taxTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Financial Totals Table */}
      <div className="w-full md:w-5/12 lg:w-4/12 print:w-[46%] print:block print:break-inside-avoid">
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2.5 print:bg-transparent print:border print:border-slate-300 print:p-2.5 print:rounded-none print:space-y-1.5 text-xs print:text-[10px]">
          <div className="flex justify-between text-slate-600">
            <span className="font-medium">Subtotal</span>
            <span className="font-bold text-slate-900 font-mono">{formatCurrency(summary.subTotal)}</span>
          </div>

          {summary.discountTotal > 0 && (
            <div className="flex justify-between text-rose-600">
              <span className="font-medium">Discount</span>
              <span className="font-bold font-mono">-{formatCurrency(summary.discountTotal)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-600">
            <span className="font-medium">Taxable Amount</span>
            <span className="font-bold text-slate-900 font-mono">{formatCurrency(summary.taxableTotal)}</span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span className="font-medium">Total GST</span>
            <span className="font-bold text-slate-900 font-mono">{formatCurrency(summary.taxTotal)}</span>
          </div>

          <div className="pt-2.5 mt-2.5 print:pt-1.5 print:mt-1.5 border-t-2 border-slate-900 flex justify-between items-center">
            <span className="text-xs print:text-[10px] font-black text-slate-900 uppercase tracking-wider">
              Grand Total
            </span>
            <span className="text-base sm:text-lg print:text-xs font-black text-slate-900 font-mono">
              {formatCurrency(summary.grandTotal)}
            </span>
          </div>

          {showPaymentBreakdown && hasPayment && (
            <div className="pt-2.5 mt-2.5 border-t border-dashed border-slate-300 space-y-1.5">
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Amount Paid</span>
                <span className="font-mono font-bold">{formatCurrency(paymentStatus.paidAmount || 0)}</span>
              </div>

              {hasSettlement && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Agreed Settlement Discount</span>
                  <span className="font-mono font-bold">-{formatCurrency(paymentStatus.settlementDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1 font-bold">
                <span className="text-slate-800">Balance Due</span>
                <span className={`font-mono ${Number(paymentStatus.balanceDue) > 0 ? 'text-rose-600' : 'text-emerald-700 font-black'}`}>
                  {formatCurrency(paymentStatus.balanceDue || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceTotals;
