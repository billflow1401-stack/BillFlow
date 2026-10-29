import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { formatCurrency, getTodayLocalDate, toLocalIsoDateTime } from '../../utils/formatters';
import { formatApiError } from '../../utils/apiError';

const PaymentSection = ({ invoice, onPaymentSuccess }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Payment Form State
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [paymentDate, setPaymentDate] = useState(getTodayLocalDate());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isFinalSettlement, setIsFinalSettlement] = useState(false);
  const [settlementReason, setSettlementReason] = useState('Customer Verbal Negotiation / Agreed Discount');

  const fetchPayments = async () => {
    try {
      const res = await api.get(`/invoices/${invoice._id}/payments`);
      setPayments(res.data.data.payments);
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoice && invoice._id) {
      fetchPayments();
    }
  }, [invoice?._id]);

  const balanceDueNum = parseFloat(invoice.paymentStatus?.balanceDue || 0);
  const enteredAmountNum = parseFloat(amount || 0);
  const calculatedWaiver = isFinalSettlement && balanceDueNum >= enteredAmountNum
    ? Math.max(0, balanceDueNum - enteredAmountNum).toFixed(2)
    : '0.00';

  const openStandardPayment = () => {
    setAmount('');
    setMethod('UPI');
    setPaymentDate(getTodayLocalDate());
    setIsFinalSettlement(false);
    setSettlementReason('Customer Verbal Negotiation / Agreed Discount');
    setReferenceNumber('');
    setNotes('');
    setError('');
    setShowForm(true);
  };

  const openQuickWaiver = () => {
    setAmount('0');
    setMethod('Settlement Discount');
    setPaymentDate(getTodayLocalDate());
    setIsFinalSettlement(true);
    setSettlementReason('Round-off / Decimal adjustment');
    setReferenceNumber('');
    setNotes(`Waived remaining ${formatCurrency(balanceDueNum)} balance as agreed verbal settlement`);
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const idempotencyKey = crypto.randomUUID();

    try {
      await api.post(`/invoices/${invoice._id}/payments`, {
        amount: String(amount || 0).trim(),
        method,
        paymentDate: toLocalIsoDateTime(paymentDate),
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        isFinalSettlement,
        settlementReason: isFinalSettlement ? settlementReason : undefined
      }, {
        headers: {
          'X-Idempotency-Key': idempotencyKey
        }
      });

      setShowForm(false);
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setIsFinalSettlement(false);

      // Refresh payments and notify parent to refresh invoice
      fetchPayments();
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err) {
      console.error('Payment error', err);
      setError(formatApiError(err, 'Failed to record payment'));
    } finally {
      setSubmitting(false);
    }
  };

  const isEligibleForPayment = ['Unpaid', 'Partially Paid', 'Overdue'].includes(invoice.status);

  return (
    <div className="mt-8 border-t border-slate-200 pt-6 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-900">Payment & Settlement History</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Record payments, round-offs, or negotiated verbal discounts to close invoices.
          </p>
        </div>

        {isEligibleForPayment && !showForm && (
          <div className="flex flex-wrap items-center gap-2">
            {balanceDueNum > 0 && balanceDueNum <= 500 && (
              <button
                type="button"
                id="quick-waive-btn"
                onClick={openQuickWaiver}
                className="inline-flex items-center px-3 py-1.5 border border-amber-300 text-xs font-semibold rounded-lg text-amber-900 bg-amber-50 hover:bg-amber-100 transition shadow-2xs"
                title="Waive small balance/paise and mark invoice as Paid"
              >
                <svg className="w-3.5 h-3.5 mr-1 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z" />
                </svg>
                Waive Remaining ({formatCurrency(balanceDueNum)})
              </button>
            )}

            <button
              id="record-payment-btn"
              onClick={openStandardPayment}
              className="inline-flex items-center px-3.5 py-1.5 border border-transparent text-xs font-semibold rounded-lg shadow-2xs text-white bg-indigo-600 hover:bg-indigo-700 transition"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Record Payment
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Record Payment & Settlement</h4>
              <p className="text-xs text-slate-500">Collect payment or mark agreed negotiated settlement</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Current Balance:</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {formatCurrency(balanceDueNum)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Received (₹) *
              </label>
              <input
                id="payment-amount-input"
                type="number"
                step="0.01"
                min="0"
                max={balanceDueNum}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Outstanding: <strong className="text-slate-800 font-mono">{formatCurrency(balanceDueNum)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
              <select
                id="payment-method-select"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Settlement Discount">Settlement Discount (Waiver)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / UTR / Txn ID</label>
              <input
                id="payment-ref-input"
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="UPI ref, Cheque no., or Receipt"
                className="block w-full border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              />
            </div>

            {/* FULL & FINAL SETTLEMENT CHECKBOX */}
            <div className="sm:col-span-2 bg-indigo-50/80 border border-indigo-200/90 rounded-xl p-3.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="final-settlement-checkbox"
                  checked={isFinalSettlement}
                  onChange={(e) => setIsFinalSettlement(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-indigo-300 rounded mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-indigo-950 block">
                    Mark as Full & Final Settlement (Agreed Verbal Discount / Round-off)
                  </span>
                  <span className="text-[11px] text-indigo-700 block mt-0.5 leading-snug">
                    Enable this if the customer negotiated an agreed lower payment (e.g. rounded ₹5,000 or ₹5,500) or to waive remaining paise. The remaining balance will be recorded as a settlement waiver and the invoice status will become <strong>PAID</strong>.
                  </span>
                </div>
              </label>

              {isFinalSettlement && (
                <div className="mt-3 pt-3 border-t border-indigo-200/80 space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Agreed Collection:</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {formatCurrency(amount || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Waived / Settlement Discount:</span>
                      <span className="font-bold text-amber-700 font-mono text-sm">
                        {formatCurrency(calculatedWaiver)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Invoice Outcome:</span>
                      <span className="font-bold text-emerald-700 text-sm">₹0.00 Balance (PAID)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
                      Reason for Settlement Discount:
                    </label>
                    <select
                      value={settlementReason}
                      onChange={(e) => setSettlementReason(e.target.value)}
                      className="block w-full border border-indigo-200 rounded-lg py-1.5 px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    >
                      <option value="Customer Verbal Negotiation / Agreed Discount">Customer Verbal Negotiation / Agreed Discount</option>
                      <option value="Round-off / Decimal adjustment">Round-off / Decimal adjustment (paise / negligible amount)</option>
                      <option value="Goodwill / Regular Customer Discount">Goodwill / Regular Customer Discount</option>
                      <option value="Bad Debt / Balance Write-off">Bad Debt / Balance Write-off</option>
                      <option value="Custom Negotiation">Custom Note</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Remarks</label>
              <input
                id="payment-notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional remark (e.g. customer paid cash on delivery)"
                className="block w-full border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-white py-1.5 px-3.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              id="payment-submit-btn"
              type="submit"
              disabled={submitting || (!isFinalSettlement && (!amount || parseFloat(amount) <= 0))}
              className="inline-flex justify-center items-center py-1.5 px-4 border border-transparent text-xs font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 shadow-2xs"
            >
              {submitting ? 'Recording...' : (isFinalSettlement ? 'Confirm Final Settlement' : 'Save Payment')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-xs">Loading payments...</p>
      ) : payments.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <ul className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <li key={payment._id} className="p-3.5 sm:p-4 hover:bg-slate-50/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {formatCurrency(payment.amount)}
                    </span>
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                      payment.method === 'Settlement Discount'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {payment.method}
                    </span>
                    {payment.isFinalSettlement && (
                      <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Full & Final Settlement
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-500">
                    {new Date(payment.paymentDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {(payment.referenceNumber || payment.notes || (payment.isFinalSettlement && Number(payment.settlementDiscount) > 0)) && (
                  <div className="mt-2 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {payment.isFinalSettlement && Number(payment.settlementDiscount) > 0 && (
                      <span className="font-semibold text-amber-800">
                        Settlement Waiver / Discount: {formatCurrency(payment.settlementDiscount)}
                      </span>
                    )}
                    {payment.referenceNumber && (
                      <span className="font-mono text-slate-600">Ref: {payment.referenceNumber}</span>
                    )}
                    {payment.notes && (
                      <span className="text-slate-700 italic">“{payment.notes}”</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-slate-500 text-xs italic">No payments recorded yet.</p>
      )}
    </div>
  );
};

export default PaymentSection;
