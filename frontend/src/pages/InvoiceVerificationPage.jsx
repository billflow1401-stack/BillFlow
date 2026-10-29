import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

const InvoiceVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const { code: paramCode } = useParams();

  const initialCode = paramCode || searchParams.get('code') || searchParams.get('id') || '';
  const initialClaimedAmount = searchParams.get('amount') || '';

  const [inputCode, setInputCode] = useState(initialCode);
  const [claimedAmount, setClaimedAmount] = useState(initialClaimedAmount);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const verifyInvoice = async (codeToVerify) => {
    const query = (codeToVerify || inputCode || '').trim();
    if (!query) {
      setError('Please enter an Invoice Number or Verification ID.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.get(`/invoices/public/verify/${encodeURIComponent(query)}`);
      setResult(res.data.data);
    } catch (err) {
      let msg = err.response?.data?.message;
      if (!msg) {
        if (!err.response) {
          msg = 'Server connection error: Cannot reach the backend API. Please make sure your phone is connected to the same Wi-Fi.';
        } else {
          msg = 'Invoice verification failed. No matching official record was found in the BillFlow Ledger.';
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      verifyInvoice(initialCode);
    }
  }, [initialCode]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    verifyInvoice(inputCode);
  };

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if claimed amount matches authentic total
  const hasClaimedAmount = Boolean(claimedAmount && claimedAmount.trim() !== '');
  const numericClaimed = hasClaimedAmount ? parseFloat(claimedAmount.replace(/[^0-9.]/g, '')) : null;
  const numericAuthentic = result ? parseFloat(result.summary?.grandTotal) : null;
  const isAmountForged = hasClaimedAmount && numericClaimed !== null && numericAuthentic !== null && Math.abs(numericClaimed - numericAuthentic) > 0.01;
  const isAmountMatched = hasClaimedAmount && numericClaimed !== null && numericAuthentic !== null && Math.abs(numericClaimed - numericAuthentic) <= 0.01;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      {/* Background ambient gradient glow */}
      <div className="max-w-4xl mx-auto">
        {/* Top Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold mb-3">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>BillFlow Trust & Verification Authority</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Official Invoice Authenticity Portal
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
            Verify the cryptographic digital signature, tamper-proof checksum, and authoritative financial totals of any BillFlow-issued tax invoice.
          </p>
        </div>

        {/* Verification Input Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md mb-8">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Verification Code or Invoice Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BF-VER-1508A22B or INV-0001"
                    className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <div className="absolute right-3 top-3 text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Stated Amount (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={claimedAmount}
                    onChange={(e) => setClaimedAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full pl-8 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Cross-checks against paper bill</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Instant mathematical SHA-256 verification
              </span>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? <Spinner size="sm" /> : 'Verify Document Authenticity'}
              </Button>
            </div>
          </form>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <Spinner size="lg" />
            <p className="mt-4 text-sm font-medium text-slate-300">Scanning cryptographic ledger & validating digital seal...</p>
          </div>
        )}

        {/* Error / Not Found Alert */}
        {error && !loading && (
          <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-6 text-center shadow-lg">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-rose-200">Verification Failed: Unrecognized Document</h3>
            <p className="mt-1 text-sm text-rose-300/80 max-w-md mx-auto">{error}</p>
            <p className="mt-3 text-xs text-rose-400 font-mono">This document may be counterfeit or was never issued through BillFlow.</p>
          </div>
        )}

        {/* Verified Result Display */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Forgery Warning Banner if claimed amount mismatches */}
            {isAmountForged && (
              <div className="bg-rose-950/80 border-2 border-rose-500 rounded-2xl p-6 shadow-2xl animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-600 text-white">
                        CRITICAL ALERT: FORGERY DETECTED
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">
                      Stated Amount Does Not Match Official Issued Record!
                    </h3>
                    <p className="text-sm text-rose-200 mt-1 leading-relaxed">
                      The customer's stated bill amount of <span className="font-bold text-white underline">₹{parseFloat(claimedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> does <strong className="uppercase">NOT match</strong> the authoritative grand total of <span className="font-bold text-emerald-400 underline">₹{parseFloat(result.summary?.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> officially recorded in the digital ledger.
                    </p>
                    <div className="mt-3 bg-rose-900/50 p-3 rounded-lg border border-rose-700/60 flex items-center justify-between text-xs text-rose-200">
                      <span>Forged Discrepancy Difference:</span>
                      <span className="font-mono font-bold text-rose-300 text-sm">
                        ₹{Math.abs(numericClaimed - numericAuthentic).toFixed(2)} Difference
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Matched Amount Notification */}
            {isAmountMatched && (
              <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-4 flex items-center gap-3 text-emerald-200 text-sm">
                <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>
                  <strong>Amount Verified:</strong> The stated amount of <strong>₹{numericClaimed.toFixed(2)}</strong> exactly matches the official issued record.
                </span>
              </div>
            )}

            {/* Certificate Header Banner */}
            <div className="bg-gradient-to-r from-emerald-950/70 via-slate-800 to-indigo-950/70 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/70 pb-6 mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Official Authenticity Verified</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {result.business?.name || 'Issuer Business'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    GSTIN: <span className="font-mono text-slate-200">{result.business?.gstin || 'Unregistered / General'}</span> • {result.business?.city}, {result.business?.state}
                  </p>
                </div>

                {/* Grand Total Callout */}
                <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 sm:text-right shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Authoritative Grand Total
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight block mt-0.5">
                    ₹{parseFloat(result.summary?.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-medium">
                    Status: <span className="text-white font-bold">{result.status}</span>
                  </span>
                </div>
              </div>

              {/* Document Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-xs">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Invoice Number</span>
                  <span className="font-mono font-bold text-white text-sm mt-0.5 block">{result.invoiceNumber}</span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Issue Date</span>
                  <span className="font-medium text-slate-200 mt-0.5 block">
                    {new Date(result.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Billed Customer</span>
                  <span className="font-semibold text-white mt-0.5 block truncate" title={result.customer?.name}>
                    {result.customer?.name || 'Walk-in Customer'}
                  </span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Authorized Signer</span>
                  <span className="font-semibold text-white mt-0.5 block truncate" title={result.digitalSignature?.signedBy}>
                    {result.digitalSignature?.signedBy}
                  </span>
                  <span className="text-[9px] text-slate-400 block">{result.digitalSignature?.designation}</span>
                </div>
              </div>

              {/* Cryptographic Checksum Token */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Cryptographic SHA-256 Checksum Fingerprint</span>
                  </div>
                  <button
                    onClick={() => copyHash(result.digitalSignature?.documentHash)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    {copied ? 'Copied!' : 'Copy Hash'}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-400 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 break-all select-all">
                  {result.digitalSignature?.documentHash}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                  <span>Verification ID: <strong className="text-white font-mono">{result.verificationCode}</strong></span>
                  <span>System Audit ID: <strong className="text-white font-mono">{result.auditId}</strong></span>
                </div>
              </div>

              {/* Audit Timeline */}
              {result.auditTimeline && result.auditTimeline.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700/70">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Chronological Ledger Event History
                  </h4>
                  <div className="space-y-2">
                    {result.auditTimeline.map((item, idx) => (
                      <div key={idx} className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-xs flex justify-between items-center gap-2">
                        <div>
                          <span className="font-bold text-white mr-2">{item.action.replace(/_/g, ' ')}</span>
                          <span className="text-slate-400">{item.description}</span>
                        </div>
                        <span className="font-mono text-slate-400 text-[10px] shrink-0">
                          {new Date(item.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Back to Application Action */}
            <div className="text-center pt-4">
              <Link
                to="/invoices"
                className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                <span>Return to Invoices Dashboard</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceVerificationPage;
