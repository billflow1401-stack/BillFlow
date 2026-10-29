import React from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';

const InvoicePaymentHistory = ({ payments = [] }) => {
  if (!payments || payments.length === 0) return null;

  return (
    <div className="mt-6 print:mt-4 pt-4 border-t border-slate-200 print:break-inside-avoid print:page-break-inside-avoid">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">Payment & Settlement History</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Record payments, round-offs, or negotiated verbal discounts to close invoices.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
        <ul className="divide-y divide-slate-100">
          {payments.map((payment, index) => (
            <li key={payment._id || index} className="p-3 sm:p-3.5 bg-white hover:bg-slate-50/50 transition">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(payment.amount)}
                  </span>
                  <span className={`px-2 py-0.5 text-[10.5px] font-semibold rounded-md border ${
                    payment.method === 'Settlement Discount'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {payment.method}
                  </span>
                  {payment.isFinalSettlement && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Full & Final Settlement
                    </span>
                  )}
                </div>

                <span className="text-xs text-slate-500 font-medium font-sans">
                  {payment.paymentDate ? formatDate(payment.paymentDate) : '-'}
                </span>
              </div>

              {(payment.referenceNumber || payment.notes || (payment.isFinalSettlement && Number(payment.settlementDiscount) > 0)) && (
                <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {payment.isFinalSettlement && Number(payment.settlementDiscount) > 0 && (
                    <span className="font-semibold text-amber-800">
                      Settlement Waiver / Discount: {formatCurrency(payment.settlementDiscount)}
                    </span>
                  )}
                  {payment.referenceNumber && (
                    <span className="font-mono text-slate-600">Ref: {payment.referenceNumber}</span>
                  )}
                  {payment.notes && (
                    <span className="text-slate-700 italic">“{payment.notes}”</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default InvoicePaymentHistory;
