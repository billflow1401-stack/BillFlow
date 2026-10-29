import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import reportApi from '../services/reportApi';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card } from '../components/ui/Card';

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

  return (
    <div className="pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales & Revenue Report</h1>
          <p className="text-sm text-slate-500 mt-1">Invoiced sales volumes, tax liability, collected cashflow, and customer receivables.</p>
        </div>
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

      <Card className="p-5 sm:p-6 mb-8 border border-slate-200/90 shadow-xs">
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
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Performance Summary ({dates.startDate} to {dates.endDate})
            </h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
              {data.invoiceCount} Invoices Total
            </span>
          </div>

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
        </div>
      )}
    </div>
  );
};

export default SalesReport;
