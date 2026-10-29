import React from 'react';
import { formatCurrency } from '../../utils/formatters';

const InvoiceItemsTable = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-6 print:mb-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 print:overflow-visible print:rounded-none print:border print:border-slate-300">
        <table className="min-w-full divide-y divide-slate-200 print:min-w-0 print:w-full print:table-fixed print:divide-slate-300 text-left text-xs">
          <colgroup className="hidden print:table-column-group">
            <col className="w-[4%]" />
            <col className="w-[28%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-slate-100/80 print:bg-slate-100">
            <tr>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-center text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">Sr.</th>
              <th scope="col" className="px-3 py-2.5 print:px-1.5 print:py-1.5 text-left text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">Item Details</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-center text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">HSN/SAC</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-right text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">Qty</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-right text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">Rate</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-right text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">Disc.</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-right text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">Taxable</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-center text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">GST%</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-right text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">GST Amt</th>
              <th scope="col" className="px-3 py-2.5 print:px-1 print:py-1.5 text-right text-[10px] print:text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200/70 print:divide-slate-300">
            {items.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-3 py-2 print:px-1 print:py-1 text-center font-mono text-slate-500 print:text-[9.5px]">
                  {index + 1}
                </td>
                <td className="px-3 py-2 print:px-1.5 print:py-1 text-slate-900 break-words print:text-[9.5px]">
                  <div className="font-semibold text-slate-900 leading-tight">{item.name}</div>
                  {item.description && <div className="text-slate-500 text-[11px] print:text-[8.5px] mt-0.5 leading-tight">{item.description}</div>}
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-center font-mono text-slate-600 print:text-[9.5px]">
                  {item.hsnSac || '-'}
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-right font-mono text-slate-900 print:text-[9.5px] whitespace-nowrap">
                  {item.quantity} {item.unit || ''}
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-right font-mono text-slate-800 print:text-[9.5px] whitespace-nowrap">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-right font-mono text-slate-600 print:text-[9.5px] whitespace-nowrap">
                  {item.discount > 0 ? formatCurrency(item.discount) : '-'}
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-right font-mono font-medium text-slate-900 print:text-[9.5px] whitespace-nowrap">
                  {formatCurrency(item.taxableValue)}
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-center font-mono text-slate-600 print:text-[9.5px] whitespace-nowrap">
                  {item.gstRate}%
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-right font-mono text-slate-800 print:text-[9.5px] whitespace-nowrap">
                  {formatCurrency(item.taxAmount)}
                </td>
                <td className="px-3 py-2 print:px-1 print:py-1 text-right font-mono font-bold text-slate-900 print:text-[9.5px] whitespace-nowrap">
                  {formatCurrency(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceItemsTable;
