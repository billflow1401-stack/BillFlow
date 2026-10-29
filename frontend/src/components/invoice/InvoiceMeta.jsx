import React from 'react';
import { formatDate } from '../../utils/formatters';

const InvoiceMeta = ({ invoice }) => {
  const isB2B = invoice.billingMode === 'GST-Registered' || Boolean(invoice.customerSnapshot?.gstin);
  const pos = invoice.placeOfSupply || invoice.customerSnapshot?.placeOfSupply || invoice.customerSnapshot?.state || 'Same as Supplier';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 bg-slate-50/80 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 print:grid-cols-3 print:gap-2 print:mb-3 print:p-2.5 print:rounded print:border-slate-200">
      <div>
        <p className="text-[11px] print:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billing Type</p>
        <p className="text-slate-900 font-semibold text-xs sm:text-sm print:text-xs mt-0.5">
          {isB2B ? 'B2B (GST Tax Invoice)' : (invoice.billingMode || 'General Walk-in')}
        </p>
      </div>
      <div>
        <p className="text-[11px] print:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Place of Supply</p>
        <p className="text-slate-900 font-semibold text-xs sm:text-sm print:text-xs mt-0.5 truncate" title={pos}>
          {pos}
        </p>
      </div>
      <div>
        <p className="text-[11px] print:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice Status</p>
        <p className="text-slate-900 font-medium print:text-xs mt-0.5">
          <span className={`inline-flex items-center px-2.5 py-0.5 print:px-2 print:py-0 rounded-full text-xs print:text-[10px] font-bold capitalize
            ${invoice.status === 'Draft' ? 'bg-slate-100 text-slate-800 border border-slate-200' : ''}
            ${invoice.status === 'Unpaid' ? 'bg-blue-100 text-blue-800 border border-blue-200' : ''}
            ${invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : ''}
            ${invoice.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800 border border-amber-200' : ''}
            ${invoice.status === 'Overdue' ? 'bg-rose-100 text-rose-800 border border-rose-200' : ''}
          `}>
            {invoice.status}
          </span>
        </p>
      </div>
    </div>
  );
};

export default InvoiceMeta;
