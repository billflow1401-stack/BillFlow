import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import reportApi from '../services/reportApi';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const SalesReport = () => {
  const navigate = useNavigate();
  const getInitialDates = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatYMD = (d) => {
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    return {
      startDate: formatYMD(firstDay),
      endDate: formatYMD(today)
    };
  };

  const [dates, setDates] = useState(getInitialDates());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await reportApi.getSalesReport(dates.startDate, dates.endDate);
      setData(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate report');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line
  }, []);

  const handleGenerate = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const handleExportCSV = () => {
    if (!data) return;
    const lines = [
      ['Sales & Revenue Report', `${dates.startDate} to ${dates.endDate}`],
      [],
      ['Metric', 'Value'],
      ['Total Sales (Gross)', data.salesTotal],
      ['Taxable Goods & Services', data.taxableTotal],
      ['Total GST Added', data.taxTotal],
      ['CGST Total', data.cgstTotal || '0.00'],
      ['SGST Total', data.sgstTotal || '0.00'],
      ['IGST Total', data.igstTotal || '0.00'],
      ['Realized Collections', data.paidAgainstIncludedInvoices],
      ['Outstanding Receivables', data.balanceDueOnIncludedInvoices],
      ['Total Invoices', data.invoiceCount],
      [],
      ['Top Selling Products & Services'],
      ['Item Name', 'Type', 'HSN/SAC', 'Units Sold', 'Revenue (INR)', 'Tax (INR)']
    ];

    if (data.topItems && data.topItems.length > 0) {
      data.topItems.forEach(it => {
        lines.push([it.name, it.type, it.hsnSac || '—', it.unitsSold, it.lineTotal, it.taxAmount]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + lines.map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Report_${dates.startDate}_${dates.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived metrics
  const salesNum = data ? Number(data.salesTotal || 0) : 0;
  const paidNum = data ? Number(data.paidAgainstIncludedInvoices || 0) : 0;
  const realizationPercent = salesNum > 0 ? Math.min(Math.round((paidNum / salesNum) * 100), 100) : 100;

  return (
    <div className="pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales & Revenue Report</h1>
          <p className="text-sm text-slate-500 mt-1">Invoiced sales volumes, tax liability, collected cashflow, and customer receivables.</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              }
            >
              Export CSV
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/reports')}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            }
          >
            Back to Reports
          </Button>
        </div>
      </div>

      {/* Date Filter Card */}
      <Card className="p-5 sm:p-6 border border-slate-200/90 shadow-xs">
        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          <div className="lg:col-span-5">
            <Input
              label="Start Date"
              type="date"
              required
              value={dates.startDate}
              onChange={(e) => setDates({ ...dates, startDate: e.target.value })}
            />
          </div>
          <div className="lg:col-span-5">
            <Input
              label="End Date"
              type="date"
              required
              value={dates.endDate}
              onChange={(e) => setDates({ ...dates, endDate: e.target.value })}
            />
          </div>
          <div className="lg:col-span-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full justify-center"
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            >
              {loading ? 'Generating...' : 'Run Report'}
            </Button>
          </div>
        </form>
        {error && (
          <div className="mt-4 bg-rose-50 border border-rose-200/80 text-rose-700 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
            {error}
          </div>
        )}
      </Card>

      {data && !loading && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Performance Summary ({dates.startDate} to {dates.endDate})
            </h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
              {data.invoiceCount} Invoices Total
            </span>
          </div>

          {/* Primary 6 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Total Sales (Gross)</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block tabular-nums">
                {formatCurrency(data.salesTotal)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Full invoice value including tax</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Taxable Goods & Services</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block tabular-nums">
                {formatCurrency(data.taxableTotal)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Base value before GST addition</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 block">Total GST Added</span>
              <span className="text-2xl font-bold text-indigo-700 mt-1 block tabular-nums">
                {formatCurrency(data.taxTotal)}
              </span>
              <span className="text-xs text-indigo-400 mt-1 block">Statutory tax liability component</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block">Realized Collections</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block tabular-nums">
                {formatCurrency(data.paidAgainstIncludedInvoices)}
              </span>
              <span className="text-xs text-emerald-600/70 mt-1 block">Received payments against bills</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 block">Outstanding Receivables</span>
              <span className="text-2xl font-bold text-amber-700 mt-1 block tabular-nums">
                {formatCurrency(data.balanceDueOnIncludedInvoices)}
              </span>
              <span className="text-xs text-amber-600/70 mt-1 block">Pending balances from clients</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Average Invoice Size</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block tabular-nums">
                {data.invoiceCount > 0
                  ? formatCurrency((Number(data.salesTotal || 0) / data.invoiceCount).toFixed(2))
                  : '₹0.00'}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Gross sales per transaction</span>
            </div>
          </div>

          {/* Cashflow Realization & Settlement Health Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Cashflow Realization Rate
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  ({formatCurrency(data.paidAgainstIncludedInvoices)} collected of {formatCurrency(data.salesTotal)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  realizationPercent >= 80
                    ? 'bg-emerald-100 text-emerald-800'
                    : realizationPercent >= 50
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {realizationPercent}% Realized
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {data.settledCount || 0} Settled / {data.unsettledCount || 0} Pending
                </span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  realizationPercent >= 80 ? 'bg-emerald-500' : realizationPercent >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${realizationPercent}%` }}
              />
            </div>
          </div>

          {/* Two-Column Analytics Grid: GST Breakdown & Item Types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* GST Tax Composition */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                  Statutory GST Breakdown
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <span>Intra-State: {data.intraStateCount || 0}</span>
                  <span>•</span>
                  <span>Inter-State: {data.interStateCount || 0}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">CGST</span>
                  <span className="text-base font-bold text-slate-900 mt-1 block tabular-nums">
                    {formatCurrency(data.cgstTotal || '0.00')}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">SGST</span>
                  <span className="text-base font-bold text-slate-900 mt-1 block tabular-nums">
                    {formatCurrency(data.sgstTotal || '0.00')}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">IGST</span>
                  <span className="text-base font-bold text-slate-900 mt-1 block tabular-nums">
                    {formatCurrency(data.igstTotal || '0.00')}
                  </span>
                </div>
              </div>

              {/* Rate Slabs Breakdown */}
              {data.rateSlabs && data.rateSlabs.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                    GST Rate Slabs Distribution
                  </span>
                  <div className="space-y-1.5">
                    {data.rateSlabs.map(slab => (
                      <div key={slab.gstRate} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-700">
                          {slab.gstRate}% Slab ({slab.count} lines)
                        </span>
                        <div className="flex items-center gap-3 tabular-nums font-mono">
                          <span className="text-slate-500">Taxable: {formatCurrency(slab.taxableValue)}</span>
                          <span className="font-bold text-indigo-700">Tax: {formatCurrency(slab.taxAmount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Products vs Services Category Performance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  Goods (HSN) vs Services (SAC)
                </h4>
                <span className="text-[11px] font-semibold text-slate-500">By Billed Revenue</span>
              </div>

              {data.typeBreakdown && data.typeBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {data.typeBreakdown.map(tb => (
                    <div key={tb.type} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={tb.type === 'Product' ? 'info' : 'purple'}>
                            {tb.type === 'Product' ? 'Goods (HSN)' : 'Services (SAC)'}
                          </Badge>
                          <span className="text-xs text-slate-500 font-medium">
                            {tb.totalUnits} units across {tb.lineCount} lines
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          {formatCurrency(tb.salesTotal)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200/40">
                        <span>Taxable: {formatCurrency(tb.taxableTotal)}</span>
                        <span className="text-indigo-600 font-medium">GST: {formatCurrency(tb.taxTotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-6">No itemized supply data in this range.</p>
              )}
            </div>
          </div>

          {/* Top 5 Revenue-Generating Products & Services */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Top Revenue-Generating Products & Services</h4>
                <p className="text-xs text-slate-500 mt-0.5">Ranked by invoiced sales volume in the selected date range.</p>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                Top Performers
              </span>
            </div>

            {data.topItems && data.topItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">HSN / SAC</th>
                      <th className="py-3 px-4 text-right">Units Sold</th>
                      <th className="py-3 px-4 text-right">Taxable Value</th>
                      <th className="py-3 px-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-3.5 px-4">
                          <Badge variant={item.type === 'Product' ? 'info' : 'purple'}>
                            {item.type}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          {item.hsnSac ? (
                            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {item.hsnSac}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700 tabular-nums">{item.unitsSold}</td>
                        <td className="py-3.5 px-4 text-right text-slate-600 tabular-nums">{formatCurrency(item.taxableValue)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-8">No item-level sales recorded in this period.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
