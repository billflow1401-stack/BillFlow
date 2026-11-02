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
  const { user, business } = useAuth();
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
  }, [user?._id]);

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

      const blob = new Blob([rawData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

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

  const getInitials = (name) => {
    if (!name) return 'W';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const renderKPIs = () => {
    if (!data) return null;
    const { kpis } = data;

    const salesNum = Number(kpis.salesTotal) || 0;
    const paidNum = Number(kpis.paidTotal) || 0;
    const collectionPercent = salesNum > 0 ? Math.min(100, Math.round((paidNum / salesNum) * 100)) : 100;

    const metrics = [
      {
        label: 'Monthly Sales',
        value: formatCurrency(kpis.salesTotal),
        badgeText: `${kpis.invoiceCount} ${kpis.invoiceCount === 1 ? 'Invoice' : 'Invoices'}`,
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        iconBg: 'bg-indigo-500/10 text-indigo-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'Collected Payments',
        value: formatCurrency(kpis.paidTotal),
        badgeText: `${collectionPercent}% Collected`,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        iconBg: 'bg-emerald-500/10 text-emerald-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'Outstanding Balance',
        value: formatCurrency(kpis.outstandingAmount),
        badgeText: Number(kpis.outstandingAmount) > 0 ? 'Pending' : 'All Settled',
        badgeColor: Number(kpis.outstandingAmount) > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200',
        iconBg: Number(kpis.outstandingAmount) > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-100 text-slate-500',
        valueClass: Number(kpis.outstandingAmount) > 0 ? 'text-amber-900' : 'text-slate-900',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'GST Collected',
        value: formatCurrency(kpis.taxTotal),
        badgeText: 'Tax Liability',
        badgeColor: 'bg-sky-50 text-sky-700 border-sky-100',
        iconBg: 'bg-sky-500/10 text-sky-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {m.label}
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.iconBg}`}>
                {m.icon}
              </div>
            </div>
            <div>
              <p className={`text-2xl font-bold tracking-tight tabular-nums ${m.valueClass || 'text-slate-900'}`}>
                {m.value}
              </p>
              <div className="mt-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${m.badgeColor}`}>
                  {m.badgeText}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPaymentReminders = () => {
    if (!data) return null;
    const reminders = data.overdueReminders || [];
    if (reminders.length === 0) return null;

    const totalBalance = data.kpis?.overdueRemindersBalance || '0.00';

    return (
      <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs overflow-hidden mb-6">
        {/* Clean Header - No verbose or ugly descriptions */}
        <div className="px-5 py-4 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-bold text-slate-900">Payment Reminders</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                {reminders.length} Unpaid
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">
              {formatCurrency(totalBalance)} Due
            </span>
            <Link
              to="/invoices"
              className="text-xs font-semibold text-amber-900 hover:text-amber-950 hover:underline"
            >
              View Invoices &rarr;
            </Link>
          </div>
        </div>

        {/* Reminders List */}
        <Table className="border-0 shadow-none rounded-none">
          <Thead>
            <Tr hover={false}>
              <Th>Invoice #</Th>
              <Th>Customer</Th>
              <Th>Age</Th>
              <Th>Status</Th>
              <Th align="right">Balance Due</Th>
              <Th align="right">Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {reminders.map((r) => {
              const cleanPhone = r.customerPhone ? String(r.customerPhone).replace(/\D/g, '') : '';
              const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

              const storeName = business?.name || user?.businessName || 'Our Store';
              const invoiceNum = r.invoiceNumber || 'INV';

              // Automatically resolve public live domain so links work on customer mobile phones
              const isLocal = typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '[::1]'
              );
              const publicDomain = isLocal
                ? 'https://billflow-frontend-xsox.onrender.com'
                : window.location.origin;

              const receiptUrl = `${publicDomain}/verify/${encodeURIComponent(invoiceNum)}`;

              // Clean, robust formatting without fragile 4-byte surrogate emojis that corrupt into 
              const waMessage = 
`*PAYMENT REMINDER*

Dear *${r.customerName}*,

Greetings from *${storeName}*!

This is a courteous reminder regarding your pending balance for Invoice *#${invoiceNum}*.

*Invoice Summary:*
• *Invoice Date:* ${formatDate(r.date)}
• *Total Bill:* ${formatCurrency(r.grandTotal)}
• *Amount Paid:* ${formatCurrency(r.paidAmount)}
• *Outstanding Balance Due:* *${formatCurrency(r.balanceDue)}*
• *Pending Duration:* ${r.daysElapsed} days

*Official Receipt & Payment Details:*
${receiptUrl}

Kindly arrange the payment at your earliest convenience via UPI, Cash, Card, or Net Banking.

_If you have already processed this payment, please disregard this message._

Thank you for your business!
*${storeName}*`;

              const waText = encodeURIComponent(waMessage);

              return (
                <Tr key={r._id} className="hover:bg-amber-50/20">
                  <Td className="font-semibold text-slate-900 font-mono text-xs">
                    <Link
                      to={`/invoices/${r._id}`}
                      className="text-indigo-600 hover:text-indigo-900 font-bold"
                    >
                      {r.invoiceNumber || 'Invoice'}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm truncate max-w-[170px]">
                        {r.customerName}
                      </span>
                      {cleanPhone.length >= 10 && (
                        <a
                          href={`https://wa.me/${waNumber}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold transition-colors"
                          title="Send WhatsApp payment reminder"
                        >
                          <svg className="w-3 h-3 fill-current text-emerald-600" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                          </svg>
                          WhatsApp
                        </a>
                      )}
                    </div>
                    {r.customerPhone && (
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {r.customerPhone}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                      {r.daysElapsed}d ago
                    </span>
                  </Td>
                  <Td>
                    <Badge
                      status={r.status === 'Partially Paid' ? 'warning' : 'danger'}
                      size="sm"
                      dot
                    >
                      {r.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <span className="text-sm font-bold text-rose-700 tabular-nums">
                      {formatCurrency(r.balanceDue)}
                    </span>
                  </Td>
                  <Td align="right">
                    <Link
                      to={`/invoices/${r._id}`}
                      className="inline-flex items-center px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
                    >
                      Settle &rarr;
                    </Link>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </div>
    );
  };

  const renderRecentInvoices = () => {
    if (!data) return null;
    const invoices = data.recentInvoices || [];

    if (invoices.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Invoices Yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Start generating fast GST bills for your customers.</p>
          <Link to="/invoices/new">
            <Button size="sm">Create First Invoice</Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent Invoices</h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest transactions & customer billings</p>
          </div>
          <Link
            to="/invoices"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
          >
            <span>View All</span>
            <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        </div>

        {/* Invoices Table */}
        <Table className="border-0 shadow-none rounded-none">
          <Thead>
            <Tr hover={false}>
              <Th>Invoice #</Th>
              <Th>Customer</Th>
              <Th>Date</Th>
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

              const customerName = invoice.customerSnapshot?.name || 'Walk-in Customer';

              return (
                <Tr key={invoice._id} className="hover:bg-slate-50/80 transition-colors">
                  <Td className="font-semibold text-slate-900 font-mono text-xs">
                    <Link to={`/invoices/${invoice._id}`} className="hover:text-indigo-600">
                      {invoice.invoiceNumber || 'Draft'}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {getInitials(customerName)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 text-sm block truncate max-w-[160px]">
                          {customerName}
                        </span>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-slate-500 text-xs">
                    {formatDate(invoice.date)}
                  </Td>
                  <Td>
                    <Badge status={statusBadge} size="sm" dot>
                      {invoice.status}
                    </Badge>
                  </Td>
                  <Td align="right" className="font-bold text-slate-900 tabular-nums text-sm">
                    {formatCurrency(invoice.summary?.grandTotal || 0)}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/invoices/${invoice._id}`}
                        className="text-xs font-semibold text-slate-700 hover:text-indigo-600 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        View
                      </Link>
                      {invoice.status === 'Draft' ? (
                        <Link
                          to={`/invoices/new?edit=${invoice._id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(invoice)}
                          disabled={downloadingId === invoice._id}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2.5 py-1 rounded-md hover:bg-emerald-50 transition-colors disabled:opacity-50"
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
      </div>
    );
  };

  const renderSidePanel = () => {
    if (!data) return null;
    const { kpis } = data;

    const quickLinks = [
      {
        title: 'New Fast Invoice',
        desc: 'Walk-in counter or B2B bill',
        to: '/invoices/new',
        iconBg: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        ),
      },
      {
        title: 'Stock & Inventory',
        desc: 'Adjust item counts & catalog',
        to: '/inventory',
        iconBg: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        title: 'Customers Directory',
        desc: 'Profiles, contact & GSTIN',
        to: '/customers',
        iconBg: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        title: 'Tax & Sales Reports',
        desc: 'GSTR reports & trends',
        to: '/reports',
        iconBg: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ];

    const hasStockAlert = (kpis.lowStockCount || 0) > 0 || (kpis.outOfStockCount || 0) > 0;

    return (
      <div className="space-y-6">
        {/* Quick Workflows */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {quickLinks.map((link, idx) => (
              <Link
                key={idx}
                to={link.to}
                className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${link.iconBg}`}>
                    {link.icon}
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold text-slate-900 block group-hover:text-indigo-600 transition-colors">
                      {link.title}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">{link.desc}</span>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all text-sm ml-2">
                  &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Inventory Status Widget */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Inventory Health</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                hasStockAlert ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {hasStockAlert ? 'Needs Attention' : 'Optimal'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Link
              to="/inventory"
              className="p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/20 transition-all flex flex-col justify-between"
            >
              <span className="text-[11px] font-semibold text-slate-500">Low Stock</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-amber-700 tabular-nums">
                  {kpis.lowStockCount || 0}
                </span>
                <span className="text-[10px] text-slate-400">Items</span>
              </div>
            </Link>

            <Link
              to="/inventory"
              className="p-3 rounded-xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50/20 transition-all flex flex-col justify-between"
            >
              <span className="text-[11px] font-semibold text-slate-500">Out of Stock</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-rose-700 tabular-nums">
                  {kpis.outOfStockCount || 0}
                </span>
                <span className="text-[10px] text-slate-400">Items</span>
              </div>
            </Link>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Stock replenishment</span>
            <Link to="/inventory" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Manage &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-medium text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  const currentDateFormatted = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {currentDateFormatted}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time financial performance, cash flow, and store operations.
          </p>
        </div>

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

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="danger" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Main KPI Row */}
          {renderKPIs()}

          {/* 2-Column Responsive Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              {renderPaymentReminders()}
              {renderRecentInvoices()}
            </div>

            <div className="lg:col-span-1">
              {renderSidePanel()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
