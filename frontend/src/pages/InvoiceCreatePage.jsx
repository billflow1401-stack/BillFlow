import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import api from '../api/axios';
import { formatApiError } from '../utils/apiError';
import { formatCurrency } from '../utils/formatters';
import { INDIAN_STATES, getStateCodeFromGstin } from '../utils/gstStateCodes';

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;

const InvoiceCreatePage = () => {
  const [billingMode, setBillingMode] = useState('General'); // 'General' | 'GST-Registered'
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  // Payment settlement state (for all customer types: Anonymous, General with details, GST-Registered)
  const [showQuickDetails, setShowQuickDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Unpaid'
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isCustomPaymentAmount, setIsCustomPaymentAmount] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [quickCustomer, setQuickCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    state: ''
  });
  const [showPhoneOnInvoice, setShowPhoneOnInvoice] = useState(false);

  const isAnonymous = billingMode === 'General' && (!showQuickDetails || (!quickCustomer.name?.trim() && !quickCustomer.phone?.trim()));

  // For anonymous customers, pay later is disallowed and payment method defaults to Cash
  useEffect(() => {
    if (isAnonymous && paymentMethod === 'Unpaid') {
      setPaymentMethod('Cash');
    }
  }, [isAnonymous, paymentMethod]);

  // GST-Registered mode customer selection & validation
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerError, setCustomerError] = useState(null);
  const [registeredPlaceOfSupply, setRegisteredPlaceOfSupply] = useState('');
  const [registeredDeliveryState, setRegisteredDeliveryState] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [lineItems, setLineItems] = useState([
    { _id: crypto.randomUUID(), itemId: '', quantity: 1, discount: 0, unitPriceOverride: '' }
  ]);

  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const editInvoiceId = queryParams.get('edit');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let active = true;
    if (editInvoiceId) {
      queueMicrotask(() => {
        if (active) {
          setIsEditing(true);
          fetchInvoiceToEdit(editInvoiceId);
        }
      });
    }
    return () => { active = false; };
  }, [editInvoiceId]);

  const fetchInvoiceToEdit = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/invoices/${id}`);
      const data = res.data;
      if (data) {
        const inv = data.data.invoice;
        if (inv.status !== 'Draft') {
          setError('Cannot edit a finalized invoice.');
          setLoading(false);
          return;
        }

        const mode = inv.billingMode || (inv.customerSnapshot?.gstin ? 'GST-Registered' : 'General');
        setBillingMode(mode);

        if (mode === 'GST-Registered') {
          setSelectedCustomer(inv.customerSnapshot?.customerId || '');
          setRegisteredPlaceOfSupply(inv.placeOfSupply || '');
        } else {
          const snap = inv.customerSnapshot;
          if (snap && snap.name && snap.name !== 'Walk-in / Counter Sale') {
            setShowQuickDetails(true);
            setQuickCustomer({
              name: snap.name || '',
              phone: snap.phone || '',
              address: snap.billingAddress || snap.address || '',
              state: snap.state || inv.placeOfSupply || ''
            });
            if (snap.showPhoneOnInvoice !== undefined) {
              setShowPhoneOnInvoice(Boolean(snap.showPhoneOnInvoice));
            }
          }
          if (inv.showPhoneOnInvoice !== undefined) {
            setShowPhoneOnInvoice(Boolean(inv.showPhoneOnInvoice));
          }
        }

        setDate(inv.date ? inv.date.split('T')[0] : '');
        setNotes(inv.notes || '');

        if (inv.items && inv.items.length > 0) {
          setLineItems(inv.items.map(item => ({
            _id: crypto.randomUUID(),
            itemId: item.itemId,
            quantity: item.quantity,
            discount: item.discount,
            unitPriceOverride: item.unitPrice
          })));
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(formatApiError(err, 'Failed to fetch invoice.'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
    fetchItems();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      const data = res.data;
      if (data) setCustomers(data.data.customers);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await api.get('/items');
      const data = res.data;
      if (data) setItems(data.data.items);
    } catch (err) {
      console.error('Failed to fetch items', err);
    }
  };

  // Handle switching billing mode
  const handleModeChange = (newMode) => {
    if (newMode === billingMode) return;
    setBillingMode(newMode);
    setError(null);
    setCustomerError(null);

    // Incompatible customer data is cleared/reset across modes
    if (newMode === 'General') {
      setSelectedCustomer('');
      setRegisteredPlaceOfSupply('');
      setRegisteredDeliveryState('');
    } else {
      setShowQuickDetails(false);
      setQuickCustomer({ name: '', phone: '', address: '', state: '' });
    }
  };

  // Validate customer when selected in GST-Registered mode
  const handleCustomerSelect = (customerId) => {
    setSelectedCustomer(customerId);
    setCustomerError(null);
    if (!customerId) return;

    const cust = customers.find(c => c._id === customerId);
    if (!cust) return;

    const gstin = (cust.gstin || '').trim().toUpperCase();
    if (!gstin) {
      setCustomerError(`Customer "${cust.name}" does not have a recorded GSTIN. GST-Registered invoices legally require a valid GSTIN.`);
    } else if (!GSTIN_REGEX.test(gstin)) {
      setCustomerError(`Customer "${cust.name}" has an invalid GSTIN format ("${gstin}"). Please edit their profile before billing.`);
    } else {
      const gstinState = getStateCodeFromGstin(gstin);
      if (!gstinState) {
        setCustomerError(`Customer "${cust.name}" has an invalid state code in GSTIN "${gstin}".`);
      }
    }
  };

  // Trigger preview calculation when line items, customer or mode changes
  useEffect(() => {
    let ignore = false;
    const validLineItems = lineItems.filter(li => li.itemId && li.quantity > 0);
    if (validLineItems.length > 0) {
      const timerId = setTimeout(() => {
        if (!ignore) {
          calculatePreview(validLineItems, () => ignore);
        }
      }, 400);
      return () => {
        ignore = true;
        clearTimeout(timerId);
      };
    } else {
      queueMicrotask(() => {
        if (!ignore) setPreview(null);
      });
      return () => { ignore = true; };
    }
  }, [lineItems, selectedCustomer, billingMode, quickCustomer, registeredPlaceOfSupply, registeredDeliveryState, showPhoneOnInvoice]);

  // Keep payment amount synced with preview grand total (locked for anonymous customers)
  useEffect(() => {
    if (isAnonymous) {
      if (preview?.summary?.grandTotal != null) {
        setPaymentAmount(String(preview.summary.grandTotal));
      }
    } else if (!isCustomPaymentAmount && preview?.summary?.grandTotal != null) {
      setPaymentAmount(String(preview.summary.grandTotal));
    }
  }, [preview?.summary?.grandTotal, isCustomPaymentAmount, isAnonymous]);

  const calculatePreview = async (validLineItems, getIgnore = () => false) => {
    try {
      const payload = {
        billingMode,
        customerId: billingMode === 'GST-Registered' ? (selectedCustomer || undefined) : undefined,
        showPhoneOnInvoice,
        quickCustomer: billingMode === 'General' && (quickCustomer.name || quickCustomer.phone || quickCustomer.address || quickCustomer.state) ? {
          name: (quickCustomer.name || '').trim(),
          phone: (quickCustomer.phone || '').trim(),
          showPhoneOnInvoice,
          address: (quickCustomer.address || '').trim(),
          billingAddress: (quickCustomer.address || '').trim(),
          state: (quickCustomer.state || '').trim()
        } : undefined,
        placeOfSupply: billingMode === 'GST-Registered'
          ? (registeredPlaceOfSupply || undefined)
          : (quickCustomer.state ? quickCustomer.state.trim() : undefined),
        deliveryState: billingMode === 'GST-Registered'
          ? (registeredDeliveryState || undefined)
          : undefined,
        items: validLineItems.map(li => ({
          itemId: li.itemId,
          quantity: Number(li.quantity),
          discount: li.discount !== '' && li.discount != null ? String(li.discount).trim() : '0.00',
          ...(li.unitPriceOverride !== '' && li.unitPriceOverride != null && { unitPriceOverride: String(li.unitPriceOverride).trim() })
        }))
      };

      const res = await api.post('/invoices/calculate', payload);
      if (getIgnore()) return;
      const data = res.data;
      if (data) {
        setPreview(data.data.preview);
        setError(null);
      }
    } catch (err) {
      setError(formatApiError(err, 'Failed to calculate preview.'));
      console.error(err);
    }
  };

  const handleLineChange = (index, field, value) => {
    const newItems = [...lineItems];
    newItems[index][field] = value;
    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { _id: crypto.randomUUID(), itemId: '', quantity: 1, discount: 0, unitPriceOverride: '' }]);
  };

  const removeLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const buildInvoicePayload = () => {
    const validLineItems = lineItems.filter(li => li.itemId && li.quantity > 0);
    return {
      billingMode,
      customerId: billingMode === 'GST-Registered' ? selectedCustomer : undefined,
      showPhoneOnInvoice,
      quickCustomer: billingMode === 'General' && (quickCustomer.name || quickCustomer.phone || quickCustomer.address || quickCustomer.state) ? {
        name: (quickCustomer.name || '').trim(),
        phone: (quickCustomer.phone || '').trim(),
        showPhoneOnInvoice,
        address: (quickCustomer.address || '').trim(),
        billingAddress: (quickCustomer.address || '').trim(),
        state: (quickCustomer.state || '').trim()
      } : undefined,
      placeOfSupply: billingMode === 'GST-Registered'
        ? (registeredPlaceOfSupply || undefined)
        : (quickCustomer.state ? quickCustomer.state.trim() : undefined),
      deliveryState: billingMode === 'GST-Registered'
        ? (registeredDeliveryState || undefined)
        : undefined,
      date: new Date(date).toISOString(),
      notes,
      items: validLineItems.map(li => ({
        itemId: li.itemId,
        quantity: Number(li.quantity),
        discount: li.discount !== '' && li.discount != null ? String(li.discount).trim() : '0.00',
        ...(li.unitPriceOverride !== '' && li.unitPriceOverride != null && { unitPriceOverride: String(li.unitPriceOverride).trim() })
      }))
    };
  };

  const saveDraft = async () => {
    if (billingMode === 'GST-Registered' && !selectedCustomer) {
      setError('Please select a GST-registered customer.');
      return;
    }
    if (billingMode === 'GST-Registered' && customerError) {
      setError(customerError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = buildInvoicePayload();
      const url = isEditing ? `/invoices/${editInvoiceId}` : '/invoices';

      let res;
      if (isEditing) {
        res = await api.patch(url, payload);
      } else {
        res = await api.post(url, payload);
      }

      const data = res.data;
      if (data) {
        alert('Draft saved! ID: ' + data.data.invoice._id);
        navigate('/invoices/' + data.data.invoice._id);
      }
    } catch (err) {
      setError(formatApiError(err, 'Failed to save draft.'));
    }
    setLoading(false);
  };

  const finalizeInvoice = async () => {
    if (billingMode === 'GST-Registered' && !selectedCustomer) {
      setError('Please select a GST-registered customer.');
      return;
    }
    if (billingMode === 'GST-Registered' && customerError) {
      setError(customerError);
      return;
    }

    // Validate payment settlement
    if (isAnonymous) {
      if (paymentMethod === 'Unpaid') {
        setError('Anonymous walk-in customers must pay in full at checkout. Please select a payment method.');
        return;
      }
      const grandTotalNum = preview?.summary?.grandTotal ? Number(preview.summary.grandTotal) : 0;
      const amtNum = Number(paymentAmount);
      if (grandTotalNum > 0 && Math.abs(amtNum - grandTotalNum) > 0.01) {
        setError('Anonymous walk-in customers must pay the full invoice amount at checkout. To allow partial payment or pay later, please add customer details.');
        return;
      }
    } else if (paymentMethod !== 'Unpaid') {
      const grandTotalNum = preview?.summary?.grandTotal ? Number(preview.summary.grandTotal) : 0;
      const amtNum = Number(paymentAmount);
      if (isNaN(amtNum) || amtNum <= 0) {
        setError('Please enter a valid payment amount greater than ₹0.00, or choose "Pay Later (Unpaid)".');
        return;
      }
      if (grandTotalNum > 0 && amtNum > grandTotalNum + 0.001) {
        setError(`Payment amount (₹${amtNum.toFixed(2)}) cannot exceed the invoice grand total (₹${grandTotalNum.toFixed(2)}).`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const payload = buildInvoicePayload();
      const draftUrl = isEditing ? `/invoices/${editInvoiceId}` : '/invoices';

      let draftRes;
      if (isEditing) {
        draftRes = await api.patch(draftUrl, payload);
      } else {
        draftRes = await api.post(draftUrl, payload);
      }

      const draftData = draftRes.data;
      const draftId = draftData.data.invoice._id;

      const finalizeRes = await api.post(`/invoices/${draftId}/finalize`);
      const finalizeData = finalizeRes.data;
      const finalizedInvoice = finalizeData.data.invoice;

      // For any customer type: record payment if method is not 'Unpaid'
      if (paymentMethod !== 'Unpaid') {
        const grandTotal = Number(finalizedInvoice.summary?.grandTotal || 0);
        const amtToPay = !isCustomPaymentAmount && grandTotal > 0
          ? grandTotal
          : Number(paymentAmount);

        if (amtToPay > 0) {
          try {
            await api.post(`/invoices/${draftId}/payments`, {
              amount: String(amtToPay.toFixed(2)),
              method: paymentMethod,
              paymentDate: new Date().toISOString(),
              referenceNumber: paymentReference ? paymentReference.trim() : undefined,
              notes: paymentNotes ? paymentNotes.trim() : (amtToPay >= grandTotal - 0.001 ? 'Full payment at creation' : 'Partial payment at creation')
            }, {
              headers: {
                'X-Idempotency-Key': crypto.randomUUID()
              }
            });

            const isFull = amtToPay >= grandTotal - 0.001;
            const balanceLeft = Math.max(0, grandTotal - amtToPay);
            if (isFull) {
              alert(`Invoice Finalized & Paid! Number: ${finalizedInvoice.invoiceNumber} (${formatCurrency(amtToPay)} settled in full via ${paymentMethod})`);
            } else {
              alert(`Invoice Finalized & Partially Paid! Number: ${finalizedInvoice.invoiceNumber} (${formatCurrency(amtToPay)} paid via ${paymentMethod}, Balance Due: ${formatCurrency(balanceLeft)})`);
            }
            navigate('/invoices/' + finalizedInvoice._id);
            return;
          } catch (payErr) {
            console.error('Payment recording error:', payErr);
            alert(`Invoice ${finalizedInvoice.invoiceNumber} Finalized, but payment could not be recorded: ${formatApiError(payErr)}`);
            navigate('/invoices/' + finalizedInvoice._id);
            return;
          }
        }
      }

      alert('Invoice Finalized! Number: ' + finalizedInvoice.invoiceNumber + ' (Unpaid)');
      navigate('/invoices/' + finalizedInvoice._id);
    } catch (err) {
      setError(formatApiError(err, 'Failed to finalize invoice.'));
    }
    setLoading(false);
  };

  const registeredCustomers = customers.filter(c => c.gstStatus === 'Registered' || (c.gstin && c.gstin.trim().length > 0));

  // Reusable Payment & Settlement component for all customer types
  const renderPaymentSection = () => {
    const grandTotalNum = preview?.summary?.grandTotal ? Number(preview.summary.grandTotal) : 0;
    const amountNum = Number(paymentAmount) || 0;
    const isUnpaid = paymentMethod === 'Unpaid';
    const isFull = grandTotalNum > 0 && Math.abs(amountNum - grandTotalNum) < 0.01;
    const isPartial = grandTotalNum > 0 && amountNum > 0 && amountNum < (grandTotalNum - 0.009);
    const isOver = grandTotalNum > 0 && amountNum > (grandTotalNum + 0.009);
    const balanceDue = Math.max(0, grandTotalNum - amountNum);

    const allMethods = [
      { id: 'Cash', label: 'Cash', icon: '💵' },
      { id: 'UPI', label: 'UPI / QR', icon: '📱' },
      { id: 'Card', label: 'Card / POS', icon: '💳' },
      { id: 'Bank Transfer', label: 'Bank Transfer', icon: '🏦' },
      { id: 'Cheque', label: 'Cheque', icon: '🧾' },
      { id: 'Unpaid', label: 'Pay Later (Unpaid)', icon: '⏳' }
    ];

    const methods = isAnonymous
      ? allMethods.filter(m => m.id !== 'Unpaid')
      : allMethods;

    return (
      <Card className="p-6 mb-8">
        <div className="flex justify-between items-center mb-4 border-b pb-2 flex-wrap gap-2">
          <h2 className="text-lg font-medium text-gray-900">
            Payment Method & Settlement
          </h2>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
              isAnonymous
                ? 'bg-emerald-100 text-emerald-800'
                : isUnpaid
                ? 'bg-amber-100 text-amber-800'
                : isFull
                ? 'bg-emerald-100 text-emerald-800'
                : isPartial
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-gray-200 text-gray-700'
            }`}>
              {isAnonymous ? 'Full Payment Required' : isUnpaid ? 'Pay Later (Unpaid)' : isFull ? 'Full Payment' : isPartial ? 'Partial Payment' : 'Settlement Mode'}
            </span>
            <span className="text-xs text-gray-500 hidden sm:inline">
              {isAnonymous
                ? 'Anonymous walk-in counter sales must be paid in full on the spot.'
                : isUnpaid
                ? 'Invoice will be marked Unpaid. Payment can be recorded later.'
                : isFull
                ? 'Invoice will be marked Paid upon finalization.'
                : isPartial
                ? `₹${amountNum.toFixed(2)} paid now • Balance ₹${balanceDue.toFixed(2)} due.`
                : 'Choose payment method; specify full or partial amount below.'}
            </span>
          </div>
        </div>

        {/* Method Selection Buttons */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isAnonymous ? 'md:grid-cols-5' : 'md:grid-cols-6'} gap-2`} role="radiogroup" aria-label="Payment Method">
          {methods.map(m => {
            const isSelected = paymentMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                id={`pay-method-${m.id.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setPaymentMethod(m.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                  isSelected
                    ? m.id === 'Unpaid'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-400/40'
                      : 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-400/40'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
              >
                <span className="text-sm">{m.icon}</span>
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settlement Container: Anonymous flow (locked full payment) vs Standard flow (custom/partial allowed) */}
        {isAnonymous ? (
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 mt-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  Settlement Amount ({paymentMethod})
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  ✓ Full Settlement: {formatCurrency(grandTotalNum)}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                Anonymous walk-in • Full payment required at counter
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Amount Paid (₹) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold text-sm pointer-events-none">
                    ₹
                  </span>
                  <input
                    id="payment-amount-input"
                    type="text"
                    readOnly
                    value={grandTotalNum > 0 ? Number(grandTotalNum).toFixed(2) : '0.00'}
                    className="block w-full pl-7 pr-3 py-1.5 text-sm font-bold rounded-md border border-emerald-400 bg-emerald-50/30 text-emerald-900 cursor-not-allowed"
                  />
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Settled in full via {paymentMethod}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reference / Txn ID (Optional)
                </label>
                <input
                  id="payment-reference-input"
                  type="text"
                  placeholder="e.g. UPI Ref / Txn ID / Card Auth #"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  className="block w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Recorded in invoice payment history
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Notes (Optional)
                </label>
                <input
                  id="payment-notes-input"
                  type="text"
                  placeholder="e.g. Counter checkout"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="block w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Audit trail notes
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
              <span>Need to offer credit or accept partial payment?</span>
              <button
                type="button"
                id="enable-customer-details-for-credit-btn"
                onClick={() => setShowQuickDetails(true)}
                className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
              >
                + Add Customer Details to Enable Partial / Pay Later &rarr;
              </button>
            </div>
          </div>
        ) : !isUnpaid && (
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 mt-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  Payment Amount ({paymentMethod})
                </span>
                {isFull && (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    ✓ Full Paid
                  </span>
                )}
                {isPartial && (
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    ⚡ Partially Paid (Balance: {formatCurrency(balanceDue)})
                  </span>
                )}
                {isOver && (
                  <span className="bg-red-100 text-red-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    ⚠️ Exceeds Total
                  </span>
                )}
              </div>

              {grandTotalNum > 0 && !isFull && (
                <button
                  type="button"
                  id="pay-full-btn"
                  onClick={() => {
                    setIsCustomPaymentAmount(false);
                    setPaymentAmount(String(grandTotalNum));
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                >
                  Pay Full ({formatCurrency(grandTotalNum)}) &rarr;
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Amount to Pay (₹) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold text-sm pointer-events-none">
                    ₹
                  </span>
                  <input
                    id="payment-amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={e => {
                      setIsCustomPaymentAmount(true);
                      setPaymentAmount(e.target.value);
                    }}
                    className={`block w-full pl-7 pr-3 py-1.5 text-sm font-semibold rounded-md border ${
                      isOver
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50/30'
                        : isFull
                        ? 'border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/20 text-emerald-900'
                        : isPartial
                        ? 'border-amber-400 focus:ring-amber-500 focus:border-amber-500 bg-amber-50/20 text-amber-900'
                        : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-gray-500 mt-1 flex justify-between">
                  <span>Grand Total: {formatCurrency(grandTotalNum)}</span>
                  {isPartial && <span className="font-semibold text-amber-700">Due: {formatCurrency(balanceDue)}</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reference / Txn ID (Optional)
                </label>
                <input
                  id="payment-reference-input"
                  type="text"
                  placeholder="e.g. UPI Ref / Txn ID / Cheque #"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  className="block w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Recorded in invoice payment history
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Notes (Optional)
                </label>
                <input
                  id="payment-notes-input"
                  type="text"
                  placeholder="e.g. Counter deposit, advance"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="block w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Audit trail notes
                </span>
              </div>
            </div>

            {isOver && (
              <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-200">
                Entered payment amount ({formatCurrency(amountNum)}) cannot exceed the invoice grand total ({formatCurrency(grandTotalNum)}).
              </p>
            )}
          </div>
        )}
      </Card>
    );
  };

  const handleBackToDashboard = () => {
    const hasUnsavedWork =
      lineItems.some(i => Boolean(i.itemId && String(i.itemId).trim())) ||
      Boolean(quickCustomer.name?.trim()) ||
      Boolean(quickCustomer.phone?.trim()) ||
      Boolean(selectedCustomer);

    if (hasUnsavedWork) {
      const confirmLeave = window.confirm(
        'You have unsaved invoice changes. Are you sure you want to return to the Dashboard?'
      );
      if (!confirmLeave) return;
    }
    navigate('/dashboard');
  };

  return (
    <div className="pb-12 max-w-5xl mx-auto space-y-6 antialiased">
      {/* Top Navigation & Title Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4.5 rounded-xl border border-gray-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            id="back-to-dashboard-btn"
            onClick={handleBackToDashboard}
            leftIcon={
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            }
          >
            Back to Dashboard
          </Button>
          <div className="h-5 w-px bg-gray-200 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              {isEditing ? 'Edit Draft Invoice' : 'Create Invoice'}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {billingMode === 'General' ? 'Counter Walk-in Sale' : 'B2B GST-Registered Invoice'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Badge
            status={billingMode === 'General' ? 'info' : 'success'}
            dot
          >
            {billingMode === 'General' ? 'Fast Walk-in' : 'B2B Registered'}
          </Badge>
        </div>
      </div>

      {error && <div className="bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-200 text-sm font-medium">{error}</div>}

      {/* Mode Selector */}
      <div className="mb-6 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
          Select Customer Billing Mode
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={billingMode === 'General'}
            id="mode-general-btn"
            onClick={() => handleModeChange('General')}
            className={`p-3.5 rounded-lg text-left transition-all flex items-start gap-3 border ${
              billingMode === 'General'
                ? 'bg-indigo-50/80 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${billingMode === 'General' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">General / Walk-in</span>
                <span className="text-[10px] uppercase font-bold tracking-wide bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  Fast Counter
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                For retail & unregistered customers. Instant checkout without mandatory profile; optional name/phone.
              </p>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={billingMode === 'GST-Registered'}
            id="mode-gst-btn"
            onClick={() => handleModeChange('GST-Registered')}
            className={`p-3.5 rounded-lg text-left transition-all flex items-start gap-3 border ${
              billingMode === 'GST-Registered'
                ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${billingMode === 'GST-Registered' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">GST-Registered Customer</span>
                <span className="text-[10px] uppercase font-bold tracking-wide bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  B2B Tax Credit
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                For registered businesses & sole proprietors. Uses validated customer profile and GSTIN.
              </p>
            </div>
          </button>
        </div>
      </div>

      <Card className="p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">
          {billingMode === 'General' ? 'Customer Details (General / Walk-in)' : 'Customer Details (GST-Registered B2B)'}
        </h2>

        {billingMode === 'General' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3.5 rounded-lg border border-gray-200 gap-3">
              <div>
                <span className="text-sm font-semibold text-gray-900 block">
                  {quickCustomer.name ? quickCustomer.name : 'Walk-in / Counter Sale'}
                </span>
                <span className="text-xs text-gray-500">
                  {quickCustomer.phone ? `Phone: ${quickCustomer.phone}${!showPhoneOnInvoice ? ' (Hidden on bill)' : ''} • ` : ''}
                  {quickCustomer.state ? `State: ${quickCustomer.state}` : 'Statutory Section 10(1)(ca) Intra-state fallback applies if state is unrecorded.'}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowQuickDetails(!showQuickDetails)}
              >
                {showQuickDetails ? 'Hide Quick Details' : '+ Add Customer Details'}
              </Button>
            </div>



            {showQuickDetails && (
              <div className="bg-indigo-50/40 p-4 rounded-lg border border-indigo-100 space-y-4">
                <div className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                  Optional Walk-in Customer Info (Saved automatically to Customers page)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      id="quick-customer-name"
                      label="Customer Name"
                      placeholder="e.g. Rahul Sharma"
                      value={quickCustomer.name}
                      onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      id="quick-customer-phone"
                      label="Mobile Number"
                      placeholder="10-digit mobile number"
                      value={quickCustomer.phone}
                      onChange={e => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
                    />
                    <div className="mt-2.5 flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-indigo-100">
                      <input
                        id="show-phone-on-invoice-checkbox"
                        type="checkbox"
                        checked={showPhoneOnInvoice}
                        onChange={e => setShowPhoneOnInvoice(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="show-phone-on-invoice-checkbox" className="text-xs text-gray-700 cursor-pointer select-none">
                        <span className="font-semibold text-gray-800">Display mobile number on bill and receipt</span>
                        <span className="block text-[11px] text-gray-500 mt-0.5 leading-tight">
                          {showPhoneOnInvoice
                            ? 'Checked: Mobile number will be printed on the customer PDF and bill.'
                            : 'Default (Unchecked): Mobile number is saved for internal records only, and hidden on customer bills & receipts.'}
                        </span>
                      </label>
                    </div>
                    {(() => {
                      if (!quickCustomer.phone) return null;
                      const dIn = quickCustomer.phone.replace(/\D/g, '');
                      const nIn = dIn.length === 12 && dIn.startsWith('91') ? dIn.slice(2) : (dIn.length === 11 && dIn.startsWith('0') ? dIn.slice(1) : dIn);
                      if (nIn.length < 10) return null;
                      const matched = customers.find(c => {
                        if (!c.phone) return false;
                        const dCust = c.phone.replace(/\D/g, '');
                        const nCust = c.normalizedPhone || (dCust.length === 12 && dCust.startsWith('91') ? dCust.slice(2) : (dCust.length === 11 && dCust.startsWith('0') ? dCust.slice(1) : dCust));
                        return nCust === nIn && (c.gstStatus === 'Registered' || (c.gstin && c.gstin.trim().length > 0));
                      });
                      if (!matched) return null;
                      return (
                        <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-md text-xs text-amber-900 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <span className="font-bold">Registered profile found:</span> &ldquo;{matched.name}&rdquo; ({matched.gstin}).
                            <span className="text-[11px] text-amber-800 block">
                              Currently in General counter receipt mode. If customer claims Input Tax Credit, switch to GST-Registered mode.
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              handleModeChange('GST-Registered');
                              handleCustomerSelect(matched._id);
                            }}
                          >
                            Switch to GST-Reg
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      id="quick-customer-address"
                      label="Address (Optional)"
                      placeholder="Street / City address"
                      value={quickCustomer.address}
                      onChange={e => setQuickCustomer({ ...quickCustomer, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recipient State (Optional)
                    </label>
                    <select
                      id="quick-customer-state"
                      value={quickCustomer.state}
                      onChange={e => setQuickCustomer({ ...quickCustomer, state: e.target.value })}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="">-- Same as Supplier (Default Walk-in Fallback) --</option>
                      {INDIAN_STATES.map(s => (
                        <option key={s.code} value={s.name}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      If left unselected, place of supply defaults to the store location as per Section 10(1)(ca).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 max-w-sm">
              <Input
                label="Invoice Date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Select
                  id="customer-select"
                  label="Registered Customer *"
                  value={selectedCustomer}
                  onChange={e => handleCustomerSelect(e.target.value)}
                >
                  <option value="">-- Select Registered Customer --</option>
                  {registeredCustomers.length > 0 ? (
                    registeredCustomers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.gstin ? `[GSTIN: ${c.gstin}]` : '(No GSTIN)'}
                      </option>
                    ))
                  ) : (
                    customers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.gstin ? `[${c.gstin}]` : ''}
                      </option>
                    ))
                  )}
                </Select>
                {customerError && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium bg-red-50 p-2 rounded border border-red-200">
                    {customerError}
                  </p>
                )}
                {selectedCustomer && !customerError && (() => {
                  const cust = customers.find(c => c._id === selectedCustomer);
                  if (!cust) return null;
                  return (
                    <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded border border-emerald-200">
                      <div>
                        <span className="font-semibold">{cust.name}</span> • GSTIN: <span className="font-mono font-bold">{cust.gstin}</span>
                        {cust.state && ` • State: ${cust.state}`}
                        {cust.phone && ` • Phone: ${cust.phone}`}
                      </div>
                      {cust.phone && (
                        <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center gap-2">
                          <input
                            id="show-phone-on-b2b-invoice-checkbox"
                            type="checkbox"
                            checked={showPhoneOnInvoice}
                            onChange={e => setShowPhoneOnInvoice(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <label htmlFor="show-phone-on-b2b-invoice-checkbox" className="text-[11px] text-emerald-900 cursor-pointer select-none">
                            Display customer phone on bill and receipt PDF
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <Input
                  label="Invoice Date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-1">
              <Input
                label="Notes / Terms"
                placeholder="Optional customer reference or delivery notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Place of Supply (POS) Override
                </label>
                <select
                  id="registered-pos-select"
                  value={registeredPlaceOfSupply}
                  onChange={e => setRegisteredPlaceOfSupply(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="">-- Auto-detect from Customer GSTIN --</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.name}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Select store state for counter handover (Sec. 10(1)(c)), or leave blank to auto-derive from customer GSTIN.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery State (Bill-to / Ship-to)
                </label>
                <select
                  id="registered-delivery-state-select"
                  value={registeredDeliveryState}
                  onChange={e => setRegisteredDeliveryState(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="">-- Same as Customer Location --</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.name}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Specify destination state when goods movement terminates at a different address (Sec. 10(1)(a)).
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 mb-8 overflow-visible">
        <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Line Items</h2>
        <div className="space-y-4">
          {lineItems.map((li, index) => (
            <div key={li._id} className="flex flex-wrap md:flex-nowrap gap-3 items-start bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="w-full md:flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <select
                  id={`line-item-select-${index}`}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={li.itemId}
                  onChange={e => handleLineChange(index, 'itemId', e.target.value)}
                >
                  <option value="">-- Select Item --</option>
                  {items.map(item => (
                    <option key={item._id} value={item._id}>
                      {item.name} {item.hsnSac ? `[HSN/SAC: ${item.hsnSac}]` : ''} — {formatCurrency(item.unitPrice)}
                    </option>
                  ))}
                </select>
                {li.itemId && (() => {
                  const chosen = items.find(i => i._id === li.itemId);
                  if (!chosen) return null;
                  return (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-gray-600">
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium border border-indigo-100">
                        {chosen.type}
                      </span>
                      {chosen.hsnSac ? (
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono border border-emerald-100">
                          HSN/SAC: {chosen.hsnSac}
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Non-GST</span>
                      )}
                      {chosen.taxType && (
                        <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">
                          {chosen.taxType} Tax
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="w-full sm:w-auto min-w-[80px]">
                <Input
                  id={`line-item-qty-${index}`}
                  label="Qty"
                  type="number"
                  value={li.quantity}
                  min="0.001"
                  step="0.001"
                  onChange={e => handleLineChange(index, 'quantity', e.target.value)}
                />
              </div>

              <div className="w-full sm:w-auto min-w-[150px]">
                <Input
                  id={`line-item-price-${index}`}
                  label="Price Override (₹)"
                  type="number"
                  step="0.01"
                  value={li.unitPriceOverride}
                  placeholder={(() => {
                    const chosen = items.find(i => i._id === li.itemId);
                    return chosen ? String(chosen.unitPrice) : '0.00';
                  })()}
                  onChange={e => handleLineChange(index, 'unitPriceOverride', e.target.value)}
                />
              </div>

              <div className="w-full sm:w-auto min-w-[130px]">
                <Input
                  id={`line-item-discount-${index}`}
                  label="Discount (₹)"
                  type="number"
                  step="0.01"
                  value={li.discount}
                  onChange={e => handleLineChange(index, 'discount', e.target.value)}
                />
              </div>

              <div className="w-full sm:w-auto flex items-end pt-6">
                <Button
                  variant="danger"
                  onClick={() => removeLineItem(index)}
                  className="w-full sm:w-auto"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button
              id="add-line-item-btn"
              variant="secondary"
              onClick={addLineItem}
            >
              + Add Line Item
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment Method & Settlement (Placed below Line Items) */}
      {renderPaymentSection()}

      {/* Live Server Preview & Authoritative GST Tax Determination */}
      {preview && (
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Calculations & GST Determination</h2>

          {/* Authoritative Tax Decision Box */}
          {preview.taxDecision && (
            <div className="p-4 mb-6 rounded-lg border bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border-blue-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 text-sm">Place of Supply (POS):</span>
                  <span className="bg-white px-2.5 py-1 rounded font-bold text-sm border border-blue-200 text-blue-900 shadow-sm">
                    {preview.taxDecision.placeOfSupply}
                    {preview.taxDecision.placeOfSupplyStateCode ? ` (Code ${preview.taxDecision.placeOfSupplyStateCode})` : ''}
                  </span>
                </div>
                <div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                    preview.taxDecision.supplyType === 'INTRA_STATE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-purple-100 text-purple-800 border border-purple-300'
                  }`}>
                    {preview.taxDecision.supplyType === 'INTRA_STATE' ? 'Intra-state Supply · CGST + SGST' : 'Inter-state Supply · IGST'}
                  </span>
                </div>
              </div>

              {preview.taxDecision.isFallback && (
                <div className="mt-2.5 text-xs text-amber-900 bg-amber-50 p-2.5 rounded border border-amber-200 flex items-start gap-2">
                  <span className="font-bold text-sm leading-none">⚖️</span>
                  <span>
                    <strong>Section 10(1)(ca) Fallback:</strong> No recipient state/address was recorded on this counter sale. As mandated by Section 10(1)(ca) of the IGST Act, the supplier&apos;s location is applied as the statutory place of supply, correctly charging intra-state CGST + SGST.
                  </span>
                </div>
              )}

              {!preview.taxDecision.isFallback && preview.taxDecision.explanation && (
                <div className="mt-2 text-xs text-gray-600 bg-white/70 p-2 rounded border border-blue-100">
                  {preview.taxDecision.explanation}
                </div>
              )}

              {/* Rule 46 Threshold Notice for Unregistered Sales >= ₹50,000 */}
              {preview.taxDecision?.rule46?.thresholdExceeded && !preview.taxDecision?.rule46?.compliant && (
                <div className="mt-3 p-3.5 rounded-lg border bg-red-50 border-red-300 text-red-900 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-base leading-none">⚠️</span>
                    <div>
                      <div className="font-bold text-sm">GST Rule 46 Mandatory Requirement</div>
                      <p className="mt-1">
                        Taxable supply value is <strong>{formatCurrency(preview.summary.taxableTotal)}</strong> (&ge; &#8377;50,000). Under GST Rule 46, invoices issued to unregistered recipients for &#8377;50,000 or more legally mandate recording the recipient&apos;s name, address, and delivery state with state code.
                      </p>
                      <p className="mt-1 font-semibold text-red-800">
                        Missing required particulars: {preview.taxDecision.rule46.missingFields.join(', ')}.
                      </p>
                      {!showQuickDetails && (
                        <button
                          type="button"
                          onClick={() => setShowQuickDetails(true)}
                          className="mt-2 inline-flex items-center text-xs font-bold text-red-700 underline hover:text-red-900"
                        >
                          Click here to enter required customer details &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 text-sm max-w-md ml-auto">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-medium text-gray-900">{formatCurrency(preview.summary.subTotal)}</span>
            </div>
            {preview.summary.discountTotal > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-{formatCurrency(preview.summary.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-100">
              <span>Taxable Value:</span>
              <span>{formatCurrency(preview.summary.taxableTotal)}</span>
            </div>

            {Number(preview.summary.cgstTotal) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>CGST:</span>
                <span>{formatCurrency(preview.summary.cgstTotal)}</span>
              </div>
            )}
            {Number(preview.summary.sgstTotal) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>SGST:</span>
                <span>{formatCurrency(preview.summary.sgstTotal)}</span>
              </div>
            )}
            {Number(preview.summary.igstTotal) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>IGST:</span>
                <span>{formatCurrency(preview.summary.igstTotal)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-lg pt-4 border-t border-gray-200 mt-2 text-indigo-900">
              <span>Grand Total:</span>
              <span>{formatCurrency(preview.summary.grandTotal)}</span>
            </div>

            {/* Real-time Payment Settlement Summary */}
            {(() => {
              const grandTotalNum = preview?.summary?.grandTotal ? Number(preview.summary.grandTotal) : 0;
              const amountNum = Number(paymentAmount) || 0;
              const isUnpaid = paymentMethod === 'Unpaid';
              const isFull = grandTotalNum > 0 && Math.abs(amountNum - grandTotalNum) < 0.01;
              const isPartial = grandTotalNum > 0 && amountNum > 0 && amountNum < (grandTotalNum - 0.009);
              const balanceDue = Math.max(0, grandTotalNum - amountNum);

              return (
                <div className="pt-2.5 border-t border-gray-100 flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Settlement Plan:</span>
                  <span>
                    {isUnpaid ? (
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
                        Pay Later (Unpaid)
                      </span>
                    ) : isFull ? (
                      <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                        {paymentMethod} — Full Paid ({formatCurrency(amountNum)})
                      </span>
                    ) : isPartial ? (
                      <span className="text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                        {paymentMethod} — Partial: {formatCurrency(amountNum)} (Due: {formatCurrency(balanceDue)})
                      </span>
                    ) : (
                      <span className="text-gray-700 font-semibold">{paymentMethod}</span>
                    )}
                  </span>
                </div>
              );
            })()}

            {preview.items && preview.items.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <div className="font-semibold text-gray-700 mb-1">Applied GST Breakdown:</div>
                {preview.items.map((pi, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span>{pi.name} {pi.hsnSac ? `[${pi.hsnSac}]` : ''}</span>
                    <span className="font-medium text-gray-700">
                      {pi.gstRate > 0
                        ? `${pi.gstRate}% GST (${pi.cgstRate ? `${pi.cgstRate}% CGST + ${pi.sgstRate}% SGST` : `${pi.igstRate}% IGST`})`
                        : '0% / Non-GST'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {(() => {
        const isRule46Blocked = preview?.taxDecision?.rule46?.thresholdExceeded && !preview.taxDecision?.rule46?.compliant;
        const grandTotalNum = preview?.summary?.grandTotal ? Number(preview.summary.grandTotal) : 0;
        const amtNum = Number(paymentAmount) || 0;
        const isPaymentInvalid = paymentMethod !== 'Unpaid' && (
          !paymentAmount || isNaN(amtNum) || amtNum <= 0 || (grandTotalNum > 0 && amtNum > grandTotalNum + 0.009)
        );

        let finalizeLabel = 'Finalize Invoice';
        if (loading) {
          finalizeLabel = 'Finalizing...';
        } else if (paymentMethod === 'Unpaid') {
          finalizeLabel = 'Finalize Invoice (Unpaid)';
        } else if (amtNum > 0 && grandTotalNum > 0) {
          if (amtNum < grandTotalNum - 0.009) {
            finalizeLabel = `Finalize & Pay Partial (₹${amtNum.toFixed(2)} via ${paymentMethod})`;
          } else {
            finalizeLabel = `Finalize & Settle Full (₹${amtNum.toFixed(2)} via ${paymentMethod})`;
          }
        } else {
          finalizeLabel = `Finalize & Pay (${paymentMethod})`;
        }

        return (
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4.5 rounded-xl border border-gray-200/90 shadow-2xs">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBackToDashboard}
              className="text-gray-500 hover:text-gray-800"
            >
              Cancel & Return
            </Button>
            <div className="flex flex-wrap gap-3 items-center justify-end w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={saveDraft}
                disabled={loading || (billingMode === 'GST-Registered' && (!selectedCustomer || !!customerError))}
              >
                Save Draft
              </Button>
              <Button
                id="finalize-invoice-btn"
                variant="primary"
                onClick={finalizeInvoice}
                disabled={loading || (billingMode === 'GST-Registered' && (!selectedCustomer || !!customerError)) || isRule46Blocked || isPaymentInvalid}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                }
                title={
                  isRule46Blocked
                    ? 'Rule 46: Recipient name, address and delivery state required for sales >= ₹50,000'
                    : isPaymentInvalid
                    ? 'Please enter a valid payment amount (<= Grand Total) or choose Pay Later'
                    : undefined
                }
              >
                {finalizeLabel}
              </Button>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default InvoiceCreatePage;
