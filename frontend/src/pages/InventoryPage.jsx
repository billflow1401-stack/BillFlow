import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';

const InventoryPage = () => {

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Movement history
  const [selectedItem, setSelectedItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Stock In modal
  const [showStockIn, setShowStockIn] = useState(false);
  const [stockInItem, setStockInItem] = useState(null);
  const [stockInQty, setStockInQty] = useState('');
  const [stockInNote, setStockInNote] = useState('');
  const [stockInError, setStockInError] = useState('');
  const [stockInSaving, setStockInSaving] = useState(false);

  // Adjust modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustStock, setAdjustStock] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory');
      setInventory(res.data.data.inventory);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async (itemId) => {
    if (selectedItem === itemId) { setSelectedItem(null); return; }
    setSelectedItem(itemId);
    setMovementsLoading(true);
    try {
      const res = await api.get(`/inventory/${itemId}/movements`);
      setMovements(res.data.data.movements);
    } catch { setMovements([]); }
    finally { setMovementsLoading(false); }
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    setStockInSaving(true); setStockInError('');
    try {
      await api.post(`/inventory/${stockInItem._id}/stock-in`, {
        quantity: parseFloat(stockInQty),
        note: stockInNote || undefined
      });
      setShowStockIn(false);
      setStockInQty(''); setStockInNote('');
      await fetchInventory();
      if (selectedItem === stockInItem._id) fetchMovements(stockInItem._id).then(() => setSelectedItem(stockInItem._id));
    } catch (err) {
      setStockInError(err.response?.data?.message || 'Stock-in failed.');
    } finally { setStockInSaving(false); }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    setAdjustSaving(true); setAdjustError('');
    try {
      await api.post(`/inventory/${adjustItem._id}/adjust`, {
        newStock: parseFloat(adjustStock),
        note: adjustNote || undefined
      });
      setShowAdjust(false);
      setAdjustStock(''); setAdjustNote('');
      await fetchInventory();
      if (selectedItem === adjustItem._id) fetchMovements(adjustItem._id).then(() => setSelectedItem(adjustItem._id));
    } catch (err) {
      setAdjustError(err.response?.data?.message || 'Adjustment failed.');
    } finally { setAdjustSaving(false); }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'IN_STOCK': return <Badge variant="success" dot>In Stock</Badge>;
      case 'LOW_STOCK': return <Badge variant="warning" dot>Low Stock</Badge>;
      case 'OUT_OF_STOCK': return <Badge variant="danger" dot>Out of Stock</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const formatDate = (d) => new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const totalSkus = inventory.length;
  const inStockCount = inventory.filter(i => i.stockStatus === 'IN_STOCK').length;
  const lowStockCount = inventory.filter(i => i.stockStatus === 'LOW_STOCK').length;
  const outOfStockCount = inventory.filter(i => i.stockStatus === 'OUT_OF_STOCK').length;

  if (loading && inventory.length === 0) {
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory & Stock Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time stock balances, replenishment, physical count adjustments, and audit trail.</p>
        </div>
        <Link to="/items">
          <Button
            variant="secondary"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          >
            Manage Catalog Items
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tracked Items</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{totalSkus}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">In Stock</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{inStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Low Stock Alert</p>
            <p className="text-2xl font-bold text-amber-600 mt-1 tabular-nums">{lowStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Out of Stock</p>
            <p className="text-2xl font-bold text-rose-600 mt-1 tabular-nums">{outOfStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
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

      {inventory.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-xs border border-slate-200/90">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-slate-800 font-semibold text-base">No inventory records found</p>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Create products in your catalog with trackable stock to see them here.</p>
          <Link to="/items" className="inline-block mt-4">
            <Button size="sm">Go to Products</Button>
          </Link>
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th>Unit</Th>
              <Th className="text-right">Current Stock</Th>
              <Th className="text-right">Min Threshold</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {inventory.map(item => (
              <React.Fragment key={item._id}>
                <Tr className={selectedItem === item._id ? 'bg-indigo-50/30' : ''}>
                  <Td>
                    <div className="font-semibold text-slate-900">{item.name}</div>
                  </Td>
                  <Td className="text-xs font-mono text-slate-600">{item.sku || '—'}</Td>
                  <Td className="text-xs text-slate-600">{item.unit || '—'}</Td>
                  <Td className="text-right font-bold text-slate-900 tabular-nums">
                    {item.currentStock}
                  </Td>
                  <Td className="text-right text-xs text-slate-500 tabular-nums">
                    {item.lowStockThreshold != null ? item.lowStockThreshold : '—'}
                  </Td>
                  <Td>{statusBadge(item.stockStatus)}</Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setStockInItem(item); setShowStockIn(true); setStockInError(''); }}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-md transition-colors"
                      >
                        + Stock In
                      </button>
                      <button
                        onClick={() => { setAdjustItem(item); setAdjustStock(String(item.currentStock)); setShowAdjust(true); setAdjustError(''); }}
                        className="text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1 rounded-md transition-colors"
                      >
                        Adjust
                      </button>
                      <button
                        onClick={() => fetchMovements(item._id)}
                        className={`text-xs font-semibold px-2 py-1 rounded-md border transition-colors ${
                          selectedItem === item._id
                            ? 'bg-slate-200 text-slate-800 border-slate-300'
                            : 'text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {selectedItem === item._id ? 'Hide' : 'History'}
                      </button>
                    </div>
                  </Td>
                </Tr>
                {selectedItem === item._id && (
                  <Tr key={`${item._id}-history`} className="bg-slate-50/70">
                    <Td colSpan="7" className="p-0 border-t-0">
                      <div className="p-4 sm:p-5 max-h-[360px] overflow-y-auto border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Movement History for {item.name}
                          </h4>
                          <span className="text-xs text-slate-500 font-mono">
                            Current: <strong className="text-slate-900">{item.currentStock} {item.unit}</strong>
                          </span>
                        </div>
                        {movementsLoading ? (
                          <div className="py-8 flex justify-center text-xs text-slate-500">
                            <Spinner size="sm" />
                            <span className="ml-2">Loading transactions...</span>
                          </div>
                        ) : movements.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-4">No inventory movements recorded yet.</p>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                            <table className="min-w-full divide-y divide-slate-200 text-xs">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600">Timestamp</th>
                                  <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600">Type</th>
                                  <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">Quantity</th>
                                  <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">Before</th>
                                  <th className="px-3.5 py-2.5 text-right font-semibold text-slate-600">After</th>
                                  <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600">Reference</th>
                                  <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600">Note / Reason</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {movements.map(m => (
                                  <tr key={m._id} className="hover:bg-slate-50/50">
                                    <td className="px-3.5 py-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                      {formatDate(m.createdAt)}
                                    </td>
                                    <td className="px-3.5 py-2.5">
                                      <Badge
                                        variant={m.movementType === 'IN' ? 'success' : m.movementType === 'OUT' ? 'danger' : 'info'}
                                        size="xs"
                                      >
                                        {m.movementType}
                                      </Badge>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">
                                      {m.quantity}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right text-slate-500 tabular-nums">
                                      {m.balanceBefore}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                                      {m.balanceAfter}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-slate-600 font-mono text-[11px]">
                                      {m.referenceType}{m.referenceId ? ` #${String(m.referenceId).slice(-6)}` : ''}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-slate-600">
                                      {m.note || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )}
              </React.Fragment>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Stock In Modal */}
      <Modal
        isOpen={showStockIn}
        onClose={() => setShowStockIn(false)}
        title="Stock In — Add Replenishment"
        size="md"
      >
        {stockInError && (
          <div className="mb-4 bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200/80 text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
            {stockInError}
          </div>
        )}

        {stockInItem && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 flex justify-between items-center text-xs">
            <div>
              <span className="font-semibold text-slate-900 block text-sm">{stockInItem.name}</span>
              <span className="text-slate-500">SKU: {stockInItem.sku || 'N/A'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Current Balance</span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {stockInItem.currentStock} {stockInItem.unit}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleStockIn} className="space-y-4">
          <Input
            label="Quantity to Add *"
            type="number"
            step="0.01"
            min="0.01"
            value={stockInQty}
            onChange={e => setStockInQty(e.target.value)}
            placeholder="e.g. 50"
            suffix={stockInItem?.unit || 'units'}
            required
          />
          <Input
            label="Purchase Note / Reference"
            value={stockInNote}
            onChange={e => setStockInNote(e.target.value)}
            placeholder="e.g. Purchase order PO-2024 or vendor delivery"
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setShowStockIn(false)}>Cancel</Button>
            <Button type="submit" variant="success" disabled={stockInSaving}>
              {stockInSaving ? 'Saving...' : 'Add Stock In'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Modal */}
      <Modal
        isOpen={showAdjust}
        onClose={() => setShowAdjust(false)}
        title="Adjust Stock — Physical Count"
        size="md"
      >
        {adjustError && (
          <div className="mb-4 bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200/80 text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
            {adjustError}
          </div>
        )}

        {adjustItem && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 flex justify-between items-center text-xs">
            <div>
              <span className="font-semibold text-slate-900 block text-sm">{adjustItem.name}</span>
              <span className="text-slate-500">System Count: {adjustItem.currentStock} {adjustItem.unit}</span>
            </div>
            {adjustStock !== '' && !isNaN(parseFloat(adjustStock)) && (
              <div className="text-right">
                <span className="text-slate-500 block">Variance</span>
                <span className={`font-bold text-sm tabular-nums ${
                  parseFloat(adjustStock) - adjustItem.currentStock > 0 ? 'text-emerald-600' :
                  parseFloat(adjustStock) - adjustItem.currentStock < 0 ? 'text-rose-600' : 'text-slate-600'
                }`}>
                  {parseFloat(adjustStock) - adjustItem.currentStock > 0 ? '+' : ''}
                  {(parseFloat(adjustStock) - adjustItem.currentStock).toFixed(2)} {adjustItem.unit}
                </span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAdjust} className="space-y-4">
          <Input
            label="Actual Physical Count *"
            type="number"
            step="0.01"
            min="0"
            value={adjustStock}
            onChange={e => setAdjustStock(e.target.value)}
            placeholder="Verified physical quantity"
            suffix={adjustItem?.unit || 'units'}
            required
          />
          <Input
            label="Reason for Adjustment *"
            value={adjustNote}
            onChange={e => setAdjustNote(e.target.value)}
            placeholder="e.g. Monthly audit, spoilage, or broken seal"
            required
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button type="submit" disabled={adjustSaving}>
              {adjustSaving ? 'Saving...' : 'Save Stock Adjustment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InventoryPage;
