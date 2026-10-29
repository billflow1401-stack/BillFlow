import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { formatCurrency, formatDate } from '../utils/formatters';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';

const InvoiceHistoryPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page')) || 1;
  const searchStr = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const billingModeFilter = searchParams.get('billingMode') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const sort = searchParams.get('sort') || 'date';
  const order = searchParams.get('order') || 'desc';

  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const [searchInput, setSearchInput] = useState(searchStr);

  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchStr) {
        updateParams({ search: searchInput, page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, searchStr]);

  const updateParams = (newParams) => {
    const params = new URLSearchParams(searchParams);
    for (const key in newParams) {
      if (newParams[key] === '' || newParams[key] === null) {
        params.delete(key);
      } else {
        params.set(key, newParams[key]);
      }
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const queryParams = new URLSearchParams({ page, limit: pagination.limit || 20 });
      if (searchStr) queryParams.set('search', searchStr);
      if (statusFilter) queryParams.set('status', statusFilter);
      if (billingModeFilter) queryParams.set('billingMode', billingModeFilter);
      if (startDate) queryParams.set('startDate', startDate);
      if (endDate) queryParams.set('endDate', endDate);
      if (sort) queryParams.set('sort', sort);
      if (order) queryParams.set('order', order);

      const res = await api.get(`/invoices?${queryParams.toString()}`);

      setInvoices(res.data.data.invoices);
      setPagination(res.data.data.pagination);
    } catch (err) {
      console.error(err);
      setError('Failed to load invoice history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchInvoices();
    });
  }, [page, searchStr, statusFilter, billingModeFilter, startDate, endDate, sort, order]);

  const handleDownloadPdf = async (invoice) => {
    try {
      setDownloadingId(invoice._id);
      const response = await api.get(`/invoices/${invoice._id}/pdf`, {
        responseType: 'blob'
      });

      const rawData = response.data;

      if (rawData.type === 'application/json') {
        const text = await rawData.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || errorData.message || 'Failed to generate PDF');
      }

      let filename = `Invoice-${invoice.invoiceNumber || invoice._id}.pdf`;
      const disposition = response.headers?.['content-disposition'];
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
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Delay cleanup so browser download manager has time to resolve the blob URL
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Draft': return <Badge variant="neutral" dot>Draft</Badge>;
      case 'Unpaid': return <Badge variant="warning" dot>Unpaid</Badge>;
      case 'Partially Paid': return <Badge variant="info" dot>Partially Paid</Badge>;
      case 'Paid': return <Badge variant="success" dot>Paid</Badge>;
      case 'Overdue': return <Badge variant="danger" dot>Overdue</Badge>;
      case 'Cancelled': return <Badge variant="danger" dot>Cancelled</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices & Billing History</h1>
          <p className="text-sm text-slate-500 mt-1">Search, review, print, and export generated invoices and payment receipts.</p>
        </div>
        <Button
          onClick={() => navigate('/invoices/new')}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Create Invoice
        </Button>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-200/90 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          <div className="lg:col-span-3">
            <Input
              type="text"
              label="Search Invoices"
              placeholder="Search Invoice #, Customer..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              prefix={
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
          <div className="lg:col-span-2">
            <Select
              id="billing-mode-filter"
              label="Billing Mode"
              value={billingModeFilter}
              onChange={e => updateParams({ billingMode: e.target.value, page: 1 })}
            >
              <option value="">All Modes</option>
              <option value="General">General / Walk-in</option>
              <option value="GST-Registered">GST-Registered</option>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Select
              label="Payment Status"
              value={statusFilter}
              onChange={e => updateParams({ status: e.target.value, page: 1 })}
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </Select>
          </div>
          <div className="lg:col-span-1">
            <Input
              label="From"
              type="date"
              value={startDate}
              onChange={e => updateParams({ startDate: e.target.value, page: 1 })}
            />
          </div>
          <div className="lg:col-span-1">
            <Input
              label="To"
              type="date"
              value={endDate}
              onChange={e => updateParams({ endDate: e.target.value, page: 1 })}
            />
          </div>
          <div className="lg:col-span-1">
            <Select
              label="Sort"
              value={sort}
              onChange={e => updateParams({ sort: e.target.value, page: 1 })}
            >
              <option value="date">Date</option>
              <option value="invoiceNumber">Inv #</option>
              <option value="grandTotal">Total</option>
            </Select>
          </div>
          <div className="lg:col-span-1">
            <Select
              label="Order"
              value={order}
              onChange={e => updateParams({ order: e.target.value, page: 1 })}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </Select>
          </div>
          <div className="lg:col-span-1">
            <Button variant="secondary" onClick={clearFilters} className="w-full justify-center">
              Reset
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl mb-6 border border-rose-200/80 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
          </svg>
          {error}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-xs border border-slate-200/90">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-800 font-semibold text-base">No invoices found</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Create your first invoice or adjust filters to view invoice history.</p>
          <Button onClick={() => navigate('/invoices/new')} size="sm" className="mt-4">
            + Create New Invoice
          </Button>
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Invoice #</Th>
              <Th>Billing Mode</Th>
              <Th>Customer</Th>
              <Th>Status</Th>
              <Th className="text-right">Taxable</Th>
              <Th className="text-right">GST</Th>
              <Th className="text-right">Grand Total</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {invoices.map((invoice) => (
              <Tr key={invoice._id}>
                <Td>
                  <div className="font-semibold text-slate-900 font-mono text-xs">
                    {invoice.invoiceNumber || 'DRAFT'}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">{formatDate(invoice.date)}</div>
                </Td>
                <Td>
                  {invoice.billingMode === 'GST-Registered' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      GST-Registered
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      General / Walk-in
                    </span>
                  )}
                </Td>
                <Td>
                  <div className="font-semibold text-slate-900 text-xs">
                    {invoice.customerSnapshot?.name || 'Walk-in / Counter Sale'}
                  </div>
                  {invoice.customerSnapshot?.gstin ? (
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">GSTIN: {invoice.customerSnapshot.gstin}</div>
                  ) : invoice.customerSnapshot?.phone ? (
                    <div className="text-[11px] text-slate-500 mt-0.5">Ph: {invoice.customerSnapshot.phone}</div>
                  ) : null}
                </Td>
                <Td>{getStatusBadge(invoice.status)}</Td>
                <Td className="text-right text-xs text-slate-600 tabular-nums">
                  {formatCurrency(invoice.summary?.taxableTotal)}
                </Td>
                <Td className="text-right text-xs text-slate-600 tabular-nums">
                  {formatCurrency(invoice.summary?.taxTotal)}
                </Td>
                <Td className="text-right font-bold text-slate-900 text-xs tabular-nums">
                  {formatCurrency(invoice.summary?.grandTotal)}
                </Td>
                <Td className="text-right">
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
            ))}
          </Tbody>
        </Table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3 pt-2">
          <span className="text-xs font-medium text-slate-500">
            Showing page <span className="font-semibold text-slate-900">{pagination.page}</span> of <span className="font-semibold text-slate-900">{pagination.totalPages}</span>
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPrevious}
              onClick={() => updateParams({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => updateParams({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistoryPage;
