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
import { formatCurrency } from '../utils/formatters';

const emptyProductForm = {
  name: '', type: 'Product', description: '', sku: '', unit: 'pcs',
  hsnSac: '', taxType: 'Exclusive',
  unitPrice: '', costPrice: '', currentStock: '', lowStockThreshold: '',
  isActive: true, notes: ''
};

const emptyServiceForm = {
  name: '', type: 'Service', description: '', unit: 'hr',
  hsnSac: '', taxType: 'Exclusive',
  unitPrice: '', isActive: true, notes: ''
};

const ItemsPage = () => {


  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page')) || 1;
  const searchStr = searchParams.get('search') || '';
  const filterType = searchParams.get('type') || '';
  const isActiveStr = searchParams.get('isActive') || '';
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') || 'desc';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ totalPages: 1, hasNext: false, hasPrevious: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState(searchStr);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ ...emptyProductForm });
  const [taxConfigs, setTaxConfigs] = useState([]);

  useEffect(() => {
    const fetchTaxConfigs = async () => {
      try {
        const res = await api.get('/tax-config');
        if (res.data?.data?.taxConfigs) {
          setTaxConfigs(res.data.data.taxConfigs.filter(tc => tc.isActive));
        }
      } catch (err) {
        console.error('Error fetching tax configs:', err);
      }
    };
    fetchTaxConfigs();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchStr) {
        updateParams({ search: searchInput, page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, searchStr]);

  useEffect(() => {
    fetchItems();
  }, [page, searchStr, filterType, isActiveStr, sort, order]);

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

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = { page, sort, order };
      if (searchStr) params.search = searchStr;
      if (filterType) params.type = filterType;
      if (isActiveStr) params.isActive = isActiveStr;

      const res = await api.get('/items', { params });
      setItems(res.data.data.items);
      setPagination(res.data.data.pagination);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch items.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = (type = 'Product') => {
    setEditingItem(null);
    setFormData(type === 'Service' ? { ...emptyServiceForm } : { ...emptyProductForm });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    if (item.type === 'Service') {
      setFormData({
        name: item.name || '', type: 'Service',
        description: item.description || '', unit: item.unit || 'hr',
        hsnSac: item.hsnSac || '', taxType: item.taxType || 'Exclusive',
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
        isActive: item.isActive ?? true, notes: item.notes || ''
      });
    } else {
      setFormData({
        name: item.name || '', type: 'Product',
        description: item.description || '', sku: item.sku || '', unit: item.unit || 'pcs',
        hsnSac: item.hsnSac || '', taxType: item.taxType || 'Exclusive',
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
        costPrice: item.costPrice != null ? String(item.costPrice) : '',
        currentStock: item.currentStock != null ? String(item.currentStock) : '',
        lowStockThreshold: item.lowStockThreshold != null ? String(item.lowStockThreshold) : '',
        isActive: item.isActive ?? true, notes: item.notes || ''
      });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    if (inputType === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'type') {
      setFormData(value === 'Service' ? { ...emptyServiceForm } : { ...emptyProductForm });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');

    try {
      const payload = { ...formData };
      payload.unitPrice = String(payload.unitPrice).trim();
      if (!payload.unitPrice) {
        setFormError('Selling price is required.');
        setIsSaving(false);
        return;
      }

      if (!payload.hsnSac) {
        delete payload.hsnSac;
      }
      if (!payload.taxType) {
        delete payload.taxType;
      }

      if (formData.type === 'Product') {
        if (payload.costPrice !== '' && payload.costPrice != null) {
          payload.costPrice = String(payload.costPrice).trim();
        } else {
          delete payload.costPrice;
        }
        if (payload.currentStock !== '' && payload.currentStock != null) {
          payload.currentStock = parseInt(payload.currentStock, 10);
        } else {
          delete payload.currentStock;
        }
        if (payload.lowStockThreshold !== '' && payload.lowStockThreshold != null) {
          payload.lowStockThreshold = parseInt(payload.lowStockThreshold, 10);
        } else {
          delete payload.lowStockThreshold;
        }
        if (payload.sku === '') delete payload.sku;
      }

      if (editingItem) {
        await api.patch(`/items/${editingItem._id}`, payload);
      } else {
        await api.post('/items', payload);
      }
      await fetchItems();
      closeModal();
    } catch (err) {
      setFormError(formatApiError(err, 'Operation failed.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/items/${id}`);
      setItems(prev => prev.filter(i => i._id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete item.');
    }
  };

  if (loading && items.length === 0) {
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products & Services</h1>
          <p className="text-sm text-slate-500 mt-1">Catalog items, pricing, inventory thresholds, and GST tax classifications.</p>
        </div>
        <div className="flex gap-2.5">
          <Button
            onClick={() => openAddModal('Product')}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          >
            Add Product
          </Button>
          <Button
            variant="secondary"
            onClick={() => openAddModal('Service')}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          >
            Add Service
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-5 p-1 bg-slate-100/90 rounded-xl w-fit border border-slate-200/80">
        {['', 'Product', 'Service'].map(t => (
          <button
            key={t || 'All'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              filterType === t
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => updateParams({ type: t, page: 1 })}
          >
            {t === '' ? 'All Items' : t + 's'}
          </button>
        ))}
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-200/90 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          <div className="lg:col-span-4">
            <Input
              type="text"
              label="Search Catalog"
              placeholder="Search by name, SKU..."
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
              label="Status"
              value={isActiveStr}
              onChange={e => updateParams({ isActive: e.target.value, page: 1 })}
            >
              <option value="">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Select
              label="Sort By"
              value={sort}
              onChange={e => updateParams({ sort: e.target.value, page: 1 })}
            >
              <option value="createdAt">Date Added</option>
              <option value="name">Item Name</option>
              <option value="unitPrice">Unit Price</option>
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

      {items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-xs border border-slate-200/90">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-slate-800 font-semibold text-base">
            {filterType === '' ? 'No items found matching your criteria.' : `No ${filterType.toLowerCase()}s found.`}
          </p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Add products or services with HSN/SAC codes and pricing to start billing.</p>
          <div className="flex justify-center gap-2 mt-4">
            <Button onClick={() => openAddModal('Product')} size="sm">
              + Add Product
            </Button>
          </div>
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Item Details</Th>
              <Th>Type</Th>
              <Th>SKU</Th>
              <Th>HSN / SAC</Th>
              <Th className="text-right">Price</Th>
              <Th>Unit</Th>
              <Th className="text-right">Stock</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map(item => (
              <Tr key={item._id} className={!item.isActive ? 'opacity-60 bg-slate-50/50' : ''}>
                <Td>
                  <div className="font-semibold text-slate-900">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.description}</div>
                  )}
                </Td>
                <Td>
                  <Badge variant={item.type === 'Product' ? 'info' : 'purple'}>
                    {item.type}
                  </Badge>
                </Td>
                <Td className="text-xs font-mono text-slate-600">{item.sku || '—'}</Td>
                <Td>
                  {item.hsnSac ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {item.hsnSac}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs italic">None</span>
                  )}
                </Td>
                <Td className="text-right font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(item.unitPrice)}
                  <span className="block text-[10px] font-normal text-slate-400">
                    {item.taxType === 'Inclusive' ? 'GST Incl.' : '+ GST'}
                  </span>
                </Td>
                <Td className="text-xs text-slate-600">{item.unit || '—'}</Td>
                <Td className="text-right">
                  {item.type === 'Product' ? (
                    item.currentStock != null ? (
                      <span className={`font-semibold tabular-nums text-xs px-2 py-0.5 rounded ${
                        item.lowStockThreshold && item.currentStock <= item.lowStockThreshold
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'text-slate-900'
                      }`}>
                        {item.currentStock}
                      </span>
                    ) : '—'
                  ) : (
                    <span className="text-slate-400 text-xs italic">N/A</span>
                  )}
                </Td>
                <Td>
                  <Badge variant={item.isActive ? 'success' : 'danger'} dot>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                    >
                      Delete
                    </button>
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

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingItem ? `Edit ${formData.type}` : `Add New ${formData.type}`}
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">General Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {!editingItem && (
                <Select label="Item Type *" name="type" value={formData.type} onChange={handleChange}>
                  <option value="Product">Product</option>
                  <option value="Service">Service</option>
                </Select>
              )}
              <div className={!editingItem ? '' : 'md:col-span-2'}>
                <Input
                  label={`${formData.type === 'Service' ? 'Service Name' : 'Product Name'} *`}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={formData.type === 'Service' ? 'e.g. Consulting or Repair Service' : 'e.g. Basmati Rice or Dell Monitor'}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">Description</label>
                <textarea
                  name="description"
                  rows="2"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Detailed specifications or service scope..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
              </div>
              {formData.type === 'Product' && (
                <Input label="SKU / Barcode" name="sku" value={formData.sku} onChange={handleChange} placeholder="e.g. PRD-1001" />
              )}
              <Input
                label="Unit of Measurement"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                placeholder={formData.type === 'Service' ? 'hr, day, job' : 'pcs, kg, box'}
              />
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Pricing (in ₹)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Input
                label="Selling Price (₹) *"
                type="number"
                step="0.01"
                name="unitPrice"
                value={formData.unitPrice}
                onChange={handleChange}
                min="0"
                placeholder="0.00"
                required
              />
              {formData.type === 'Product' && (
                <Input
                  label="Cost Price (₹)"
                  type="number"
                  step="0.01"
                  name="costPrice"
                  value={formData.costPrice}
                  onChange={handleChange}
                  min="0"
                  placeholder="0.00"
                />
              )}
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Tax & GST Classification</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  HSN / SAC Code (Linked to Tax Config)
                </label>
                <select
                  name="hsnSac"
                  value={formData.hsnSac || ''}
                  onChange={handleChange}
                  className="block w-full h-10 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                >
                  <option value="">-- None (Non-GST / Exempt) --</option>
                  {taxConfigs.map(tc => (
                    <option key={tc._id} value={tc.hsnSac}>
                      [{tc.classificationType} {tc.hsnSac}] {tc.gstRate}% GST — {tc.description}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tax category from your Tax Config.
                </p>
              </div>
              <Select
                label="Tax Pricing Mode"
                name="taxType"
                value={formData.taxType || 'Exclusive'}
                onChange={handleChange}
              >
                <option value="Exclusive">Exclusive (GST added on top)</option>
                <option value="Inclusive">Inclusive (GST included in price)</option>
              </Select>
            </div>
          </div>

          {formData.type === 'Product' && (
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Inventory Thresholds</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <Input
                  label="Initial Stock Quantity"
                  type="number"
                  name="currentStock"
                  value={formData.currentStock}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                />
                <Input
                  label="Low Stock Alert Threshold"
                  type="number"
                  name="lowStockThreshold"
                  value={formData.lowStockThreshold}
                  onChange={handleChange}
                  min="0"
                  placeholder="5"
                />
              </div>
            </div>
          )}

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Status & Notes</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500/20 border-gray-300 rounded"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Item is active and available for billing
                </span>
              </label>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">Internal Notes</label>
                <textarea
                  name="notes"
                  rows="2"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Vendor notes, batch info, or shelf location..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ItemsPage;
