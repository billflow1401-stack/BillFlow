import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

const DashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await api.get('/dashboard/summary');
        setData(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [user.token]);

  const handleDownloadPdf = async (invoice) => {
    try {
      setDownloadingId(invoice._id);

      const res = await api.get(`/invoices/${invoice._id}/pdf`, {
        responseType: 'blob'
      });

      const rawData = res.data;

      if (rawData.type === 'application/json') {
        const text = await rawData.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || errorData.message || 'Failed to download PDF');
      }

      let filename = `Invoice-${invoice.invoiceNumber || invoice._id}.pdf`;
      const disposition = res.headers?.['content-disposition'];
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

      // Explicitly construct application/pdf Blob
      const blob = new Blob([rawData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Delay cleanup so browser download manager has time to resolve the blob URL
      setTimeout(() => {
        if (a.parentNode) {
          a.parentNode.removeChild(a);
        }
        window.URL.revokeObjectURL(url);
      }, 1000);

    } catch (err) {
      alert(err.message || 'Error downloading PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderKPIs = () => {
    if (!data) return null;
    const { kpis } = data;

    const primaryMetrics = [
      {
        label: 'Sales This Month',
        value: formatCurrency(kpis.salesTotal),
        subtitle: `${kpis.invoiceCount} invoices issued`,
        iconBg: 'bg-indigo-50 text-indigo-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'Collected Payments',
        value: formatCurrency(kpis.paidTotal),
        subtitle: 'Cash, UPI, Card & Bank',
        iconBg: 'bg-emerald-50 text-emerald-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'Outstanding Balance',
        value: formatCurrency(kpis.outstandingAmount),
        subtitle: 'Unpaid & partial balances',
        iconBg: Number(kpis.outstandingAmount) > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500',
        valueClass: Number(kpis.outstandingAmount) > 0 ? 'text-amber-800' : '',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'GST Collected',
        value: formatCurrency(kpis.taxTotal),
        subtitle: 'Output CGST + SGST + IGST',
        iconBg: 'bg-blue-50 text-blue-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
      },
    ];

    const inventoryAlerts = [
      {
        label: 'Low Stock Alert',
        value: `${kpis.lowStockCount} Items`,
        alert: kpis.lowStockCount > 0,
        badge: kpis.lowStockCount > 0 ? 'Attention' : 'Optimal',
        badgeStatus: kpis.lowStockCount > 0 ? 'warning' : 'success',
      },
      {
        label: 'Out of Stock',
        value: `${kpis.outOfStockCount} Items`,
        alert: kpis.outOfStockCount > 0,
        badge: kpis.outOfStockCount > 0 ? 'Replenish' : 'Healthy',
        badgeStatus: kpis.outOfStockCount > 0 ? 'danger' : 'success',
      },
    ];

    return (
      <div className="space-y-4 mb-8">
        {/* Main Financial Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {primaryMetrics.map((m, idx) => (
            <Card key={idx} className="p-5 flex flex-col justify-between hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {m.label}
                </span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.iconBg}`}>
                  {m.icon}
                </div>
              </div>
              <div>
                <p className={`text-2xl font-bold tracking-tight text-gray-900 tabular-nums ${m.valueClass || ''}`}>
                  {m.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{m.subtitle}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Secondary Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inventoryAlerts.map((a, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-4 rounded-xl border bg-white shadow-2xs transition-all ${
                a.alert ? 'border-amber-200/90 bg-amber-50/10' : 'border-gray-200/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    a.alert ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-700 block">{a.label}</span>
                  <span className="text-sm font-bold text-gray-900">{a.value}</span>
                </div>
              </div>
              <Badge status={a.badgeStatus} size="sm" dot>
                {a.badge}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRecentInvoices = () => {
    if (!data) return null;
    const invoices = data.recentInvoices || [];

    if (invoices.length === 0) {
      return (
        <Card
          title="Recent Invoices"
          subtitle="Latest transactions and settlements"
          action={
            <Link to="/invoices/new" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              + New Invoice
            </Link>
          }
          className="p-8 text-center"
        >
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">No invoices yet</p>
            <p className="text-xs text-gray-500 mt-1 mb-4">Create your first GST invoice in seconds.</p>
            <Link to="/invoices/new">
              <Button size="sm">Create Invoice</Button>
            </Link>
          </div>
        </Card>
      );
    }

    return (
      <Card
        title="Recent Invoices"
        subtitle="Latest transactions generated across all channels"
        action={
          <Link
            to="/invoices"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
          >
            <span>View all invoices</span>
            <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        }
        padding="none"
      >
        <Table className="border-0 shadow-none rounded-none">
          <Thead>
            <Tr hover={false}>
              <Th>Invoice #</Th>
              <Th>Date</Th>
              <Th>Recipient</Th>
              <Th>Status</Th>
              <Th align="right">Amount</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {invoices.map((invoice) => {
              let statusBadge = 'default';
              if (invoice.status === 'Paid') statusBadge = 'success';
              else if (invoice.status === 'Partially Paid') statusBadge = 'warning';
              else if (invoice.status === 'Unpaid') statusBadge = 'info';
              else if (invoice.status === 'Overdue' || invoice.status === 'Cancelled') statusBadge = 'danger';

              return (
                <Tr key={invoice._id}>
                  <Td className="font-semibold text-gray-900 font-mono text-xs">
                    {invoice.invoiceNumber || 'Draft'}
                  </Td>
                  <Td className="text-gray-500 text-xs">{formatDate(invoice.date)}</Td>
                  <Td className="text-gray-700">
                    <span className="font-medium text-gray-900 block truncate max-w-[180px]">
                      {invoice.customerSnapshot?.name || 'Walk-in / Counter Sale'}
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      {invoice.billingMode || 'General'}
                    </span>
                  </Td>
                  <Td>
                    <Badge status={statusBadge} size="sm" dot>
                      {invoice.status}
                    </Badge>
                  </Td>
                  <Td align="right" className="font-bold text-gray-900 tabular-nums">
                    {formatCurrency(invoice.summary?.grandTotal || 0)}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/invoices/${invoice._id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                      >
                        View
                      </Link>
                      {invoice.status === 'Draft' ? (
                        <Link
                          to={`/invoices/new?edit=${invoice._id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(invoice)}
                          disabled={downloadingId === invoice._id}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded hover:bg-emerald-50 transition-colors disabled:opacity-50"
                        >
                          {downloadingId === invoice._id ? 'Generating...' : 'PDF'}
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-medium text-gray-500">Loading dashboard metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time financial performance, GST liabilities, and inventory health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/invoices/new">
            <Button
              variant="primary"
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Create Invoice
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="danger" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {renderKPIs()}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {renderRecentInvoices()}
            </div>

            {/* Quick Actions Panel */}
            <div>
              <Card
                title="Quick Shortcuts"
                subtitle="Frequent business workflows"
                className="space-y-2.5"
              >
                <Link
                  to="/invoices/new"
                  className="group flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block leading-tight">
                        New Fast Invoice
                      </span>
                      <span className="text-xs text-gray-500">Walk-in counter or B2B</span>
                    </div>
                  </div>
                  <span className="text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all">
                    &rarr;
                  </span>
                </Link>

                <Link
                  to="/inventory"
                  className="group flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block leading-tight">
                        Stock In / Adjust
                      </span>
                      <span className="text-xs text-gray-500">Update item counts</span>
                    </div>
                  </div>
                  <span className="text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all">
                    &rarr;
                  </span>
                </Link>

                <Link
                  to="/customers"
                  className="group flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block leading-tight">
                        Customers Directory
                      </span>
                      <span className="text-xs text-gray-500">Profiles & GSTIN details</span>
                    </div>
                  </div>
                  <span className="text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all">
                    &rarr;
                  </span>
                </Link>

                <Link
                  to="/reports"
                  className="group flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block leading-tight">
                        Tax & Sales Reports
                      </span>
                      <span className="text-xs text-gray-500">Filing aggregations & trends</span>
                    </div>
                  </div>
                  <span className="text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all">
                    &rarr;
                  </span>
                </Link>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
