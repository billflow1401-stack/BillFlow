import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import reportApi from '../services/reportApi';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';

const GSTReport = () => {
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
  const [summary, setSummary] = useState(null);
  const [rateWise, setRateWise] = useState(null);
  const [hsnWise, setHsnWise] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [hsnPage, setHsnPage] = useState(1);
  const hsnLimit = 10;

  const fetchReport = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      const [sumRes, rateRes, hsnRes] = await Promise.all([
        reportApi.getGSTSummary(dates.startDate, dates.endDate),
        reportApi.getGSTRateWise(dates.startDate, dates.endDate),
        reportApi.getGSTHSNWise(dates.startDate, dates.endDate, page, hsnLimit)
      ]);

      setSummary(sumRes);
      setRateWise(rateRes);
      setHsnWise(hsnRes);
      setHsnPage(page);

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate report');
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
    fetchReport(1);
  };

  return (
    <div className="pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">GST Compliance & Filing Report</h1>
          <p className="text-sm text-slate-500 mt-1">Tax liability summary, tax rate breakdowns, and HSN/SAC audit trail for GSTR-1 & GSTR-3B.</p>
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
              label="Filing Period Start"
              type="date"
              required
              value={dates.startDate}
              onChange={(e) => setDates({ ...dates, startDate: e.target.value })}
            />
          </div>
          <div className="lg:col-span-5">
            <Input
              label="Filing Period End"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              {loading ? 'Generating...' : 'Run GST Report'}
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

      {summary && !loading && (
        <div className="space-y-8">
          {/* GST Summary KPI Cards */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-3">Total Tax Liability Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Central Tax (CGST)</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block tabular-nums">
                  {formatCurrency(summary.cgstTotal)}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">Intra-state center portion</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">State Tax (SGST)</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block tabular-nums">
                  {formatCurrency(summary.sgstTotal)}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">Intra-state state portion</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Integrated Tax (IGST)</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block tabular-nums">
                  {formatCurrency(summary.igstTotal)}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">Inter-state integrated levy</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-indigo-200/90 bg-indigo-50/20 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 block">Total Combined GST</span>
                <span className="text-2xl font-bold text-indigo-700 mt-1 block tabular-nums">
                  {formatCurrency(summary.totalTax)}
                </span>
                <span className="text-[11px] text-indigo-600/70 mt-1 block">Aggregate tax payable</span>
              </div>
            </div>
          </div>

          {/* Rate Wise */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Rate-wise Slabs Breakdown</h3>
                <p className="text-xs text-slate-500">Taxable turnover and tax collected across statutory tax slabs</p>
              </div>
            </div>
            <Table>
              <Thead>
                <Tr>
                  <Th>GST Rate</Th>
                  <Th>Tax Treatment</Th>
                  <Th className="text-right">Taxable Turnover</Th>
                  <Th className="text-right">CGST</Th>
                  <Th className="text-right">SGST</Th>
                  <Th className="text-right">IGST</Th>
                  <Th className="text-right">Total Tax</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rateWise && rateWise.length > 0 ? (
                  rateWise.map((row, idx) => (
                    <Tr key={idx}>
                      <Td className="font-bold text-slate-900">{row.gstRate}%</Td>
                      <Td className="text-xs text-slate-600 font-medium">{row.taxTreatment}</Td>
                      <Td className="text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(row.taxableValue)}</Td>
                      <Td className="text-right text-xs text-slate-600 tabular-nums">{formatCurrency(row.cgst)}</Td>
                      <Td className="text-right text-xs text-slate-600 tabular-nums">{formatCurrency(row.sgst)}</Td>
                      <Td className="text-right text-xs text-slate-600 tabular-nums">{formatCurrency(row.igst)}</Td>
                      <Td className="text-right font-bold text-indigo-700 tabular-nums">{formatCurrency(row.taxAmount)}</Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan="7" className="text-center text-slate-500 py-8 text-xs">No transactions recorded for this period.</Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </div>

          {/* HSN Wise */}
          {hsnWise && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">HSN / SAC Statutory Summary (Table 12)</h3>
                  <p className="text-xs text-slate-500">Classification-wise quantity and tax breakdown for GSTR-1 Table 12</p>
                </div>
              </div>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Type</Th>
                    <Th>HSN / SAC Code</Th>
                    <Th className="text-right">Total Quantity</Th>
                    <Th className="text-right">Taxable Value</Th>
                    <Th className="text-right">CGST</Th>
                    <Th className="text-right">SGST</Th>
                    <Th className="text-right">IGST</Th>
                    <Th className="text-right">Total Tax</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {hsnWise.data && hsnWise.data.length > 0 ? (
                    hsnWise.data.map((row, idx) => (
                      <Tr key={idx}>
                        <Td>
                          <Badge variant={row.classificationType === 'HSN' ? 'info' : 'purple'}>
                            {row.classificationType}
                          </Badge>
                        </Td>
                        <Td>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {row.hsnSac}
                          </span>
                        </Td>
                        <Td className="text-right text-xs font-semibold text-slate-900 tabular-nums">{row.quantity}</Td>
                        <Td className="text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(row.taxableValue)}</Td>
                        <Td className="text-right text-xs text-slate-600 tabular-nums">{formatCurrency(row.cgst)}</Td>
                        <Td className="text-right text-xs text-slate-600 tabular-nums">{formatCurrency(row.sgst)}</Td>
                        <Td className="text-right text-xs text-slate-600 tabular-nums">{formatCurrency(row.igst)}</Td>
                        <Td className="text-right font-bold text-indigo-700 tabular-nums">{formatCurrency(row.taxAmount)}</Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan="8" className="text-center text-slate-500 py-8 text-xs">No HSN data found for this period.</Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
              {/* Pagination */}
              {hsnWise.pagination && hsnWise.pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3 pt-2">
                  <span className="text-xs font-medium text-slate-500">
                    Showing page <span className="font-semibold text-slate-900">{hsnPage}</span> of <span className="font-semibold text-slate-900">{hsnWise.pagination.totalPages}</span>
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fetchReport(hsnPage - 1)}
                      disabled={hsnPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fetchReport(hsnPage + 1)}
                      disabled={hsnPage === hsnWise.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GSTReport;
