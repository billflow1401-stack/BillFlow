import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { formatApiError } from '../utils/apiError';
import { INDIAN_STATES, getStateCodeFromGstin, isGstinStateMatching } from '../utils/gstStateCodes';

const CustomersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page')) || 1;
  const searchStr = searchParams.get('search') || '';
  const customerType = searchParams.get('customerType') || '';
  const gstStatus = searchParams.get('gstStatus') || '';
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') || 'desc';

  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ totalPages: 1, hasNext: false, hasPrevious: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState(searchStr);

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', customerType: 'Individual', gstStatus: 'Unregistered', phone: '', email: '', billingAddress: '',
    city: '', state: '', pinCode: '', country: 'India', gstin: '', pan: '', notes: ''
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchStr) {
        updateParams({ search: searchInput, page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, searchStr]);

  useEffect(() => {
    fetchCustomers();
  }, [page, searchStr, customerType, gstStatus, sort, order]);

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

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = { page, sort, order };
      if (searchStr) params.search = searchStr;
      if (customerType) params.customerType = customerType;
      if (gstStatus) params.gstStatus = gstStatus;

      const res = await api.get('/customers', { params });
      setCustomers(res.data.data.customers);
      setPagination(res.data.data.pagination);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch customers.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '', customerType: 'Individual', gstStatus: 'Unregistered', phone: '', email: '', billingAddress: '',
      city: '', state: '', pinCode: '', country: 'India', gstin: '', pan: '', notes: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      customerType: customer.customerType || 'Individual',
      gstStatus: customer.gstStatus || (customer.gstin ? 'Registered' : 'Unregistered'),
      phone: customer.phone || '',
      email: customer.email || '',
      billingAddress: customer.billingAddress || '',
      city: customer.city || '',
      state: customer.state || '',
      pinCode: customer.pinCode || '',
      country: customer.country || 'India',
      gstin: customer.gstin || '',
      pan: customer.pan || '',
      notes: customer.notes || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalValue = (name === 'gstin' || name === 'pan') ? value.toUpperCase() : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: finalValue };
      // If user switches to Registered and has no GSTIN, let them enter it
      if (name === 'gstin' && finalValue.length >= 2 && !prev.state) {
        const code = getStateCodeFromGstin(finalValue);
        const matched = INDIAN_STATES.find(s => s.code === code);
        if (matched) updated.state = matched.name;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');

    // Client-side validations
    if (formData.gstStatus === 'Registered') {
      if (!formData.gstin || !formData.gstin.trim()) {
        setFormError('GSTIN is required when GST status is Registered.');
        setIsSaving(false);
        return;
      }
      if (formData.state && !isGstinStateMatching(formData.gstin, formData.state)) {
        setFormError('GSTIN state code (first 2 digits) does not match the selected state.');
        setIsSaving(false);
        return;
      }
    }

    try {
      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer._id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      await fetchCustomers();
      closeModal();
    } catch (err) {
      setFormError(formatApiError(err, 'Operation failed.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      setCustomers(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete customer.');
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage general walk-in and GST-registered customer profiles with tax credentials.</p>
        </div>
        <Button
          id="add-customer-btn"
          onClick={openAddModal}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
        >
          Add Customer
        </Button>
      </div>

      {/* Filter Tabs for GST Registration Status */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5 p-1 bg-slate-100/90 rounded-xl w-fit border border-slate-200/80">
        <button
          onClick={() => updateParams({ gstStatus: '', page: 1 })}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            gstStatus === '' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Customers
        </button>
        <button
          id="filter-unregistered-btn"
          onClick={() => updateParams({ gstStatus: 'Unregistered', page: 1 })}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            gstStatus === 'Unregistered' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          General / Unregistered
        </button>
        <button
          id="filter-registered-btn"
          onClick={() => updateParams({ gstStatus: 'Registered', page: 1 })}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            gstStatus === 'Registered' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          GST-Registered
        </button>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-200/90 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          <div className="lg:col-span-4">
            <Input
              type="text"
              label="Search Customers"
              placeholder="Search by name, phone, email, GSTIN..."
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
              label="Customer Type"
              value={customerType}
              onChange={e => updateParams({ customerType: e.target.value, page: 1 })}
            >
              <option value="">All Types</option>
              <option value="Individual">Individual</option>
              <option value="Business">Business</option>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Select
              label="Sort By"
              value={sort}
              onChange={e => updateParams({ sort: e.target.value, page: 1 })}
            >
              <option value="createdAt">Date Added</option>
              <option value="name">Customer Name</option>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Select
              label="Order"
              value={order}
              onChange={e => updateParams({ order: e.target.value, page: 1 })}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Button variant="secondary" onClick={clearFilters} className="w-full justify-center">
              Clear Filters
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

      {customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-xs border border-slate-200/90">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-slate-800 font-semibold text-base">No customers found</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Try adjusting your search criteria or add your first customer to get started.</p>
          <Button onClick={openAddModal} variant="secondary" size="sm" className="mt-4">
            + Add New Customer
          </Button>
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Customer</Th>
              <Th>GST Status</Th>
              <Th>Type</Th>
              <Th>Contact</Th>
              <Th>GSTIN / Tax ID</Th>
              <Th>Location</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {customers.map(c => {
              const isReg = c.gstStatus === 'Registered' || Boolean(c.gstin);
              return (
                <Tr key={c._id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                        {c.name ? c.name.slice(0, 2).toUpperCase() : 'CU'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        {c.notes && <div className="text-xs text-slate-400 line-clamp-1">{c.notes}</div>}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={isReg ? 'success' : 'neutral'} dot>
                      {isReg ? 'GST Registered' : 'Unregistered'}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                      {c.customerType || 'Individual'}
                    </span>
                  </Td>
                  <Td>
                    <div className="font-mono text-xs text-slate-800 font-medium">{c.phone || '—'}</div>
                    {c.email && <div className="text-xs text-slate-500">{c.email}</div>}
                  </Td>
                  <Td>
                    {c.gstin ? (
                      <span className="font-mono text-xs font-medium bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                        {c.gstin}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Unregistered</span>
                    )}
                  </Td>
                  <Td className="text-xs text-slate-600">
                    {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(c)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c._id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
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

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        size="lg"
      >
        {formError && (
          <div className="mb-5 bg-rose-50 text-rose-700 p-3.5 rounded-xl border border-rose-200/80 text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Registration & Type</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Select
                label="GST Registration Status"
                name="gstStatus"
                value={formData.gstStatus}
                onChange={handleChange}
              >
                <option value="Unregistered">Unregistered / General</option>
                <option value="Registered">GST Registered</option>
              </Select>
              <Select
                label="Customer Type"
                name="customerType"
                value={formData.customerType}
                onChange={handleChange}
              >
                <option value="Individual">Individual / Proprietor</option>
                <option value="Business">Business / Company</option>
              </Select>
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Identity & Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="md:col-span-2">
                <Input
                  label="Name / Trade Name *"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Acme Enterprises or Rahul Sharma"
                  required
                />
              </div>
              <Input
                label="Mobile Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="10-digit mobile number"
              />
              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="customer@example.com"
              />
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Tax Registration (GSTIN / PAN)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <Input
                  label={`GSTIN ${formData.gstStatus === 'Registered' ? '*' : '(Optional)'}`}
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  placeholder="27AAAAA0000A1Z5"
                  required={formData.gstStatus === 'Registered'}
                />
                {formData.gstStatus === 'Registered' && (
                  <p className="text-[11px] text-slate-500 mt-1">15-character alphanumeric GSTIN matching state code.</p>
                )}
              </div>
              <Input
                label="PAN (Optional)"
                name="pan"
                value={formData.pan}
                onChange={handleChange}
                placeholder="AAAAA0000A"
              />
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Address & Location</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="md:col-span-2">
                <Input label="Billing Address" name="billingAddress" value={formData.billingAddress} onChange={handleChange} placeholder="Street address or building" />
              </div>
              <Input label="City" name="city" value={formData.city} onChange={handleChange} placeholder="City name" />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">State</label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="block w-full h-10 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.name}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <Input label="PIN Code" name="pinCode" value={formData.pinCode} onChange={handleChange} placeholder="6-digit PIN" />
              <Input label="Country" name="country" value={formData.country} onChange={handleChange} />
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Internal Notes</h4>
            <textarea
              name="notes"
              rows="2"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Internal customer notes or special credit terms..."
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CustomersPage;
