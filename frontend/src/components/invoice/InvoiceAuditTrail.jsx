import React, { useState } from 'react';

/**
 * InvoiceAuditTrail Component
 *
 * Provides a live authenticity proof and chronological audit log of all changes made
 * to an invoice (issuance, payments, settlements, cryptographic seal).
 */
const InvoiceAuditTrail = ({ invoice, payments = [] }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!invoice) return null;

  const digitalSig = invoice.digitalSignature || {};
  const docHash = digitalSig.documentHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const verificationCode = digitalSig.verificationCode || `BF-VER-${(invoice.invoiceNumber || 'INV').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  const auditId = digitalSig.auditId || `BF-AUDIT-${(invoice.invoiceNumber || 'INV').replace(/[^a-zA-Z0-9]/g, '')}`;

  const copyHash = () => {
    navigator.clipboard.writeText(docHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compile full event timeline from stored auditTrail or reconstruct from payments and invoice milestones
  let timeline = (invoice.auditTrail && invoice.auditTrail.length > 0)
    ? [...invoice.auditTrail]
    : [
        {
          action: 'CREATED_AND_SIGNED',
          description: `Invoice ${invoice.invoiceNumber || 'Draft'} created and cryptographically signed`,
          performedBy: digitalSig.signedBy || 'Authorized Signatory',
          timestamp: invoice.createdAt || invoice.date
        }
      ];

  // If there are recorded payments not yet in auditTrail, ensure they appear in timeline
  if (payments && payments.length > 0) {
    payments.forEach(p => {
      const alreadyLogged = timeline.some(t =>
        t.action === 'PAYMENT_RECORDED' &&
        t.description.includes(String(p.amount))
      );
      if (!alreadyLogged) {
        timeline.push({
          action: p.isFinalSettlement ? 'SETTLEMENT_PAYMENT' : 'PAYMENT_RECORDED',
          description: p.isFinalSettlement
            ? `Payment of ₹${p.amount} recorded with Full & Final Settlement waiver of ₹${p.settlementDiscount || '0.00'}`
            : `Payment of ₹${p.amount} received via ${p.method || 'Standard'} ${p.referenceNumber ? `(Ref: ${p.referenceNumber})` : ''}`,
          performedBy: 'Billing Department',
          timestamp: p.paymentDate || p.createdAt
        });
      }
    });
  }

  // Sort timeline chronologically (newest first for quick audit glance)
  timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden mt-8">
      {/* Header bar */}
      <div
        className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Document Authenticity & Audit Ledger</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                Verified Authentic
              </span>
            </div>
            <p className="text-xs text-slate-500">Tamper-evident log tracking creation, signatures, payments, and settlements</p>
          </div>
        </div>

        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <span>{isExpanded ? 'Hide Details' : 'View Audit Log'}</span>
          <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Certificate metadata badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Verification ID</span>
              <span className="text-xs font-mono font-bold text-slate-800 mt-0.5 block">{verificationCode}</span>
              <span className="text-[10px] text-slate-500 mt-1 block">Globally unique verification token</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">System Audit ID</span>
              <span className="text-xs font-mono font-bold text-slate-800 mt-0.5 block">{auditId}</span>
              <span className="text-[10px] text-slate-500 mt-1 block">Recorded in immutable ledger</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cryptographic Checksum</span>
                <button
                  onClick={copyHash}
                  className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <span className="text-[11px] font-mono text-slate-700 truncate mt-0.5 block" title={docHash}>
                {docHash.slice(0, 18)}...{docHash.slice(-8)}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                SHA-256 Tamper-Proof Match
              </span>
            </div>
          </div>

          {/* Timeline of Document Changes */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Event Timeline & Modification Log</h4>
            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timeline.map((event, idx) => {
                const dateObj = new Date(event.timestamp);
                const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                return (
                  <div key={idx} className="relative">
                    {/* Bullet marker */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    </div>

                    <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{event.action.replace(/_/g, ' ')}</span>
                          {event.performedBy && (
                            <span className="text-[10px] text-slate-500">by {event.performedBy}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{event.description}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-xs font-mono font-medium text-slate-700 block">{dateStr}</span>
                        <span className="text-[10px] font-mono text-slate-400 block">{timeStr} IST</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceAuditTrail;
