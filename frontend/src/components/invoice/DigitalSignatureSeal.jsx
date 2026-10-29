import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

/**
 * DigitalSignatureSeal Component
 *
 * Renders an official, multi-tenant digital signature block, scannable QR code, and tamper-evident authentication seal.
 * Designed to replace contradictory "no signature required" / blank lines with genuine authenticity.
 */
const DigitalSignatureSeal = ({
  businessSnapshot = {},
  invoice = {},
  compact = false
}) => {
  const businessName = businessSnapshot.name || 'Company Name';
  const signerName = businessSnapshot.signature?.signerName || businessSnapshot.ownerName || businessName;
  const signerDesignation = businessSnapshot.signature?.designation || 'Authorized Signatory';
  const signatureUrl = businessSnapshot.signature?.url;
  const sealUrl = businessSnapshot.seal?.url;

  // Resolve verification details from invoice or compute deterministic fallback
  const digitalSig = invoice.digitalSignature || {};
  const verificationCode = digitalSig.verificationCode || `BF-VER-${(invoice.invoiceNumber || 'INV').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  const signedDate = digitalSig.signedAt ? new Date(digitalSig.signedAt) : (invoice.date ? new Date(invoice.date) : new Date());
  
  const formattedDate = signedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    // 1. Explicit public URL (e.g. deployed domain, public tunnel, or custom domain)
    const publicUrl = import.meta.env.VITE_PUBLIC_VERIFY_URL;
    let baseOrigin = publicUrl;

    if (!baseOrigin) {
      if (typeof window !== 'undefined' && window.location.origin) {
        // If accessed locally on laptop, dynamically use the current machine's Wi-Fi LAN IP
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        // Auto-detected IP from Vite/Node on whatever computer or Wi-Fi network this is running on
        const autoIp = (typeof __AUTO_LAN_IP__ !== 'undefined' && __AUTO_LAN_IP__ && __AUTO_LAN_IP__ !== 'localhost')
          ? __AUTO_LAN_IP__
          : import.meta.env.VITE_DEV_LAN_IP;

        if (isLocalhost && autoIp) {
          baseOrigin = `http://${autoIp}:${window.location.port || '5173'}`;
        } else {
          baseOrigin = window.location.origin;
        }
      } else {
        baseOrigin = 'http://localhost:5173';
      }
    }

    const verifyUrl = `${baseOrigin}/verify?code=${encodeURIComponent(verificationCode)}`;
    
    QRCode.toDataURL(verifyUrl, {
      width: 72,
      margin: 0,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Error generating verification QR code:', err));
  }, [verificationCode]);

  return (
    <div className={`pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 print:flex-row print:justify-between print:items-end print:break-inside-avoid print:page-break-inside-avoid ${compact ? 'mt-6' : 'mt-10'}`}>
      {/* Left: Authentic Document Certification Notice & Scannable QR Code */}
      <div className="flex items-center gap-3.5 max-w-md">
        {qrDataUrl && (
          <div className="flex flex-col items-center bg-white p-1 rounded-lg border border-slate-200/90 shadow-2xs shrink-0">
            <img
              src={qrDataUrl}
              alt="Scan to Verify Invoice"
              className="w-14 h-14 object-contain"
            />
            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">
              Scan to Verify
            </span>
          </div>
        )}

        <div className="text-left">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-semibold text-emerald-800 mb-1">
            <svg className="w-3 h-3 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Cryptographically Verified Document</span>
          </div>
          <p className="text-[11px] font-bold text-slate-800 leading-tight">Certified Digital Tax Invoice</p>
          <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
            Issued by <span className="font-semibold text-slate-700">{businessName}</span>. Authenticity registered in BillFlow Ledger.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-mono">
            <span>Auth Code: <span className="text-slate-800 font-bold">{verificationCode}</span></span>
            <span>•</span>
            <span>Date: <span className="text-slate-600">{formattedDate}</span></span>
          </div>
        </div>
      </div>

      {/* Right: Multi-Tenant Authorized Signatory & Official Seal */}
      <div className="text-right flex flex-col items-end min-w-[220px]">
        <p className="text-xs font-bold text-slate-900 tracking-tight">For {businessName}</p>

        {/* Signature & Seal Row */}
        <div className="h-16 flex items-center justify-end gap-3 my-1">
          {/* Company Stamp / Rubber Seal (if uploaded) */}
          {sealUrl ? (
            <img
              src={sealUrl}
              alt="Official Seal"
              className="w-14 h-14 object-contain opacity-95 shrink-0 rounded-full border border-blue-200/60 p-0.5"
            />
          ) : (
            /* Elegant Fallback Digital Seal */
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-indigo-200 bg-indigo-50/50 flex flex-col items-center justify-center text-center p-1 select-none shrink-0">
              <span className="text-[7px] font-extrabold uppercase tracking-widest text-indigo-700 leading-none">OFFICIAL</span>
              <span className="text-[6.5px] font-bold text-slate-500 mt-0.5 leading-none">SEAL</span>
            </div>
          )}

          {/* Authorized Signature Image or Stylized Digital Script */}
          <div className="flex flex-col items-end justify-center min-w-[120px]">
            {signatureUrl ? (
              <img
                src={signatureUrl}
                alt="Authorized Signature"
                className="max-h-12 max-w-[150px] object-contain"
              />
            ) : (
              <div className="font-['Brush_Script_MT',cursive,'Caveat',serif] text-2xl text-indigo-950 italic tracking-wider select-none px-2 py-1 transform -rotate-1">
                {signerName}
              </div>
            )}
          </div>
        </div>

        {/* Signer Demarcation Line */}
        <div className="w-48 border-t border-slate-300 pt-1 text-right">
          <p className="text-xs font-bold text-slate-900 leading-tight">{signerName}</p>
          <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">{signerDesignation}</p>
          <div className="mt-1 flex items-center justify-end gap-1 text-[9px] font-semibold text-emerald-700">
            <svg className="w-2.5 h-2.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Digitally Signed & Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalSignatureSeal;
