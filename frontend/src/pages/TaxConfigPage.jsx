import React, { useState, useEffect } from 'react';

import api from '../api/axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';
import { formatApiError } from '../utils/apiError';
import { formatCurrency } from '../utils/formatters';

const emptyForm = {
  hsnSac: '', classificationType: 'HSN', description: '', gstRate: '',
  taxTreatment: 'TAXABLE', effectiveFrom: '', effectiveTo: '',
  sourceReference: '', isActive: true
};

const TaxConfigPage = () => {

  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });

  // Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupType, setLookupType] = useState('code');
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Calculator state
  const [calcForm, setCalcForm] = useState({
    amount: '', gstRate: '18', pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE'
  });
  const [calcResult, setCalcResult] = useState(null);

  useEffect(() => { fetchConfigs(); }, []);

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/tax-config');
      setConfigs(res.data.data.taxConfigs);
    } catch { setError('Failed to fetch tax configurations.'); }
    finally { setLoading(false); }
  };

  const openAddModal = () => {
    setEditingConfig(null);
    setFormData({ ...emptyForm });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (config) => {
    setEditingConfig(config);
    setFormData({
      hsnSac: config.hsnSac || '',
      classificationType: config.classificationType || 'HSN',
      description: config.description || '',
      gstRate: config.gstRate != null ? String(config.gstRate) : '',
      taxTreatment: config.taxTreatment || 'TAXABLE',
      effectiveFrom: config.effectiveFrom ? config.effectiveFrom.split('T')[0] : '',
      effectiveTo: config.effectiveTo ? config.effectiveTo.split('T')[0] : '',
      sourceReference: config.sourceReference || '',
      isActive: config.isActive ?? true
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: inputType === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');
    try {
      const payload = { ...formData, gstRate: parseFloat(formData.gstRate) };
      if (payload.effectiveFrom) payload.effectiveFrom = new Date(payload.effectiveFrom).toISOString();
      else delete payload.effectiveFrom;
      if (payload.effectiveTo) payload.effectiveTo = new Date(payload.effectiveTo).toISOString();
      else delete payload.effectiveTo;
      if (!payload.sourceReference) delete payload.sourceReference;

      if (editingConfig) {
        await api.patch(`/tax-config/${editingConfig._id}`, payload);
      } else {
        await api.post('/tax-config', payload);
      }
      await fetchConfigs();
      closeModal();
    } catch (err) {
      setFormError(formatApiError(err, 'Operation failed.'));
    } finally { setIsSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this tax configuration?')) return;
    try {
      await api.delete(`/tax-config/${id}`);
      setConfigs(prev => prev.filter(c => c._id !== id));
    } catch { alert('Failed to delete.'); }
  };

  const handleLookup = async () => {
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    try {
      const param = lookupType === 'code' ? `code=${lookupQuery}` : `description=${lookupQuery}`;
      const res = await api.get(`/tax-config/lookup?${param}`);
      setLookupResults(res.data.data.results);
    } catch { setLookupResults([]); }
    finally { setLookupLoading(false); }
  };

  const handleCalc = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        amount: String(calcForm.amount).trim(),
        gstRate: parseFloat(calcForm.gstRate),
        pricingMode: calcForm.pricingMode,
        supplyType: calcForm.supplyType
      };
      const res = await api.post('/tax-config/calculate', payload);
      setCalcResult(res.data.data.calculation);
    } catch (err) {
      setCalcResult({ error: err.response?.data?.message || 'Calculation failed' });
    }
  };

  const fmt = (val) => val != null ? formatCurrency(val) : '-';

  if (loading && configs.length === 0) {
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">GST Tax Configuration & Rates</h1>
          <p className="text-sm text-slate-500 mt-1">Configure HSN / SAC statutory rates, search directory, and test GST calculations.</p>
        </div>
        <Button
          onClick={openAddModal}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add HSN / SAC Rate
        </Button>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl mb-6 border border-rose-200/80 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Lookup Section */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">HSN / SAC Code Lookup</h2>
              <p className="text-xs text-slate-500">Search government classifications by code or goods/service name</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-full sm:w-1/3 min-w-[120px]">
              <Select
                label="Search By"
                value={lookupType}
                onChange={(e) => setLookupType(e.target.value)}
              >
                <option value="code">Code</option>
                <option value="description">Description</option>
              </Select>
            </div>
            <div className="flex-1 flex gap-2 w-full sm:w-auto">
              <div className="flex-1">
                <Input
                  label="Keyword"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  placeholder={lookupType === 'code' ? 'e.g. 8471' : 'e.g. computer'}
                />
              </div>
              <Button type="button" onClick={handleLookup} disabled={lookupLoading} className="self-end">
                {lookupLoading ? '...' : 'Search'}
              </Button>
            </div>
          </div>

          {lookupResults !== null && (
            <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden">
              {lookupResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50">
                  No matching classification found in database.
                </div>
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Code</Th>
                      <Th>Type</Th>
                      <Th>Description</Th>
                      <Th className="text-right">GST Rate</Th>
                      <Th>Treatment</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {lookupResults.map(r => (
                      <Tr key={r._id}>
                        <Td>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {r.hsnSac}
                          </span>
                        </Td>
                        <Td>
                          <Badge variant={r.classificationType === 'HSN' ? 'info' : 'purple'}>
                            {r.classificationType}
                          </Badge>
                        </Td>
                        <Td className="text-xs text-slate-600 max-w-[180px] truncate">{r.description || '—'}</Td>
                        <Td className="text-right font-semibold text-slate-900 tabular-nums">{r.gstRate}%</Td>
                        <Td className="text-xs text-slate-500">{r.taxTreatment}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </div>
          )}
        </Card>

        {/* GST Calculator */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">GST Tax Calculator</h2>
              <p className="text-xs text-slate-500">Test intra/inter-state tax splitting and inclusive/exclusive amounts</p>
            </div>
          </div>

          <form onSubmit={handleCalc} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Amount (₹) *"
              type="number"
              step="0.01"
              value={calcForm.amount}
              min="0"
              onChange={(e) => setCalcForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="e.g. 1000"
              required
            />
            <Input
              label="GST Rate (%) *"
              type="number"
              value={calcForm.gstRate}
              min="0" max="100" step="0.01"
              onChange={(e) => setCalcForm(p => ({ ...p, gstRate: e.target.value }))}
              placeholder="18"
              required
            />
            <Select
              label="Pricing Mode"
              value={calcForm.pricingMode}
              onChange={(e) => setCalcForm(p => ({ ...p, pricingMode: e.target.value }))}
            >
              <option value="EXCLUSIVE">Exclusive (Tax added on top)</option>
              <option value="INCLUSIVE">Inclusive (Tax in price)</option>
            </Select>
            <Select
              label="Supply Type"
              value={calcForm.supplyType}
              onChange={(e) => setCalcForm(p => ({ ...p, supplyType: e.target.value }))}
            >
              <option value="INTRA_STATE">Intra-State (CGST + SGST)</option>
              <option value="INTER_STATE">Inter-State (IGST)</option>
            </Select>
            <div className="sm:col-span-2 pt-1">
              <Button type="submit" variant="secondary" className="w-full justify-center">
                Calculate GST Breakdown
              </Button>
            </div>
          </form>

          {calcResult && !calcResult.error && (
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr><td className="px-3.5 py-2 text-slate-600">Taxable Value</td><td className="px-3.5 py-2 text-right font-medium text-slate-900 tabular-nums">{fmt(calcResult.taxableAmount)}</td></tr>
                  {parseFloat(calcResult.cgst) > 0 && <tr><td className="px-3.5 py-2 text-slate-600">CGST</td><td className="px-3.5 py-2 text-right text-slate-700 tabular-nums">{fmt(calcResult.cgst)}</td></tr>}
                  {parseFloat(calcResult.sgst) > 0 && <tr><td className="px-3.5 py-2 text-slate-600">SGST</td><td className="px-3.5 py-2 text-right text-slate-700 tabular-nums">{fmt(calcResult.sgst)}</td></tr>}
                  {parseFloat(calcResult.igst) > 0 && <tr><td className="px-3.5 py-2 text-slate-600">IGST</td><td className="px-3.5 py-2 text-right text-slate-700 tabular-nums">{fmt(calcResult.igst)}</td></tr>}
                  <tr className="bg-slate-100"><td className="px-3.5 py-2 font-bold text-slate-800">Total GST</td><td className="px-3.5 py-2 text-right font-bold text-indigo-700 tabular-nums">{fmt(calcResult.totalGST)}</td></tr>
                  <tr className="bg-indigo-50/50"><td className="px-3.5 py-2.5 font-bold text-slate-900 text-sm">Invoice Grand Total</td><td className="px-3.5 py-2.5 text-right font-bold text-slate-900 text-sm tabular-nums">{fmt(calcResult.total)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {calcResult?.error && (
            <div className="mt-4 bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200/80 text-xs">
              {calcResult.error}
            </div>
          )}
        </Card>
      </div>

      {/* Config List */}
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Configured GST Rates & Codes</h2>
        <p className="text-xs text-slate-500 mt-0.5">Statutory tax slabs associated with your business catalog.</p>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-xs border border-slate-200/90">
          <p className="text-slate-800 font-semibold text-base">No tax configurations defined</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Add your first HSN/SAC rate mapping to enable tax calculations for products and services.</p>
          <Button onClick={openAddModal} size="sm" className="mt-4">
            + Add Configuration
          </Button>
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>HSN / SAC Code</Th>
              <Th>Type</Th>
              <Th>Description</Th>
              <Th className="text-right">GST Rate</Th>
              <Th>Tax Treatment</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {configs.map(c => (
              <Tr key={c._id} className={!c.isActive ? 'opacity-60 bg-slate-50/50' : ''}>
                <Td>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {c.hsnSac}
                  </span>
                </Td>
                <Td>
                  <Badge variant={c.classificationType === 'HSN' ? 'info' : 'purple'}>
                    {c.classificationType}
                  </Badge>
                </Td>
                <Td className="text-xs text-slate-700">{c.description || '—'}</Td>
                <Td className="text-right font-bold text-slate-900 tabular-nums">{c.gstRate}%</Td>
                <Td className="text-xs font-medium text-slate-600">{c.taxTreatment}</Td>
                <Td>
                  <Badge variant={c.isActive ? 'success' : 'danger'} dot>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </Badge>
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
            ))}
          </Tbody>
        </Table>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingConfig ? 'Edit Tax Rate Configuration' : 'Add New Tax Rate Configuration'}
        size="md"
      >
        {formError && (
          <div className="mb-5 bg-rose-50 text-rose-700 p-3.5 rounded-xl border border-rose-200/80 text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Classification Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input label="HSN / SAC Code *" name="hsnSac" value={formData.hsnSac} onChange={handleChange} required placeholder="e.g. 84713010" />
              <Select label="Classification Type *" name="classificationType" value={formData.classificationType} onChange={handleChange}>
                <option value="HSN">HSN (Goods)</option>
                <option value="SAC">SAC (Services)</option>
              </Select>
              <div className="sm:col-span-2">
                <Input label="Description" name="description" value={formData.description} onChange={handleChange} placeholder="e.g. Portable automatic data processing machines" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">GST Slabs & Treatment</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input label="GST Rate (%) *" type="number" name="gstRate" value={formData.gstRate} onChange={handleChange} min="0" max="100" step="0.01" placeholder="18" required />
              <Select label="Tax Treatment" name="taxTreatment" value={formData.taxTreatment} onChange={handleChange}>
                <option value="TAXABLE">Taxable</option>
                <option value="NIL_RATED">Nil Rated</option>
                <option value="EXEMPT">Exempt</option>
                <option value="NON_GST">Non-GST</option>
              </Select>
              <Input label="Effective From" type="date" name="effectiveFrom" value={formData.effectiveFrom} onChange={handleChange} />
              <Input label="Effective To" type="date" name="effectiveTo" value={formData.effectiveTo} onChange={handleChange} />
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <Input label="Statutory Source Reference" name="sourceReference" value={formData.sourceReference} onChange={handleChange} placeholder="e.g. Notification 01/2017-CT(R)" />
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500/20 border-gray-300 rounded" />
              <span className="text-xs font-semibold text-slate-800">Rate is active for billing</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : editingConfig ? 'Update Rate' : 'Save Rate'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TaxConfigPage;
