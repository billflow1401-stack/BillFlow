import React, { useState, useEffect } from 'react';

import api from '../api/axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { formatApiError, extractFieldErrors } from '../utils/apiError';

const BusinessProfilePage = () => {
  const [form, setForm] = useState({
    name: '', ownerName: '', tagline: '', address: '', city: '', state: '', pinCode: '', country: 'India',
    gstin: '', pan: '', phone: '', alternatePhone: '', email: '', website: '', logoUrl: '',
    bankDetails: { bankName: '', accountNumber: '', ifsc: '', branchName: '', accountName: '' },
    invoiceSettings: { prefix: 'INV-', defaultDueDays: 7, notes: '' },
    signature: { url: '', signerName: '', designation: 'Authorized Signatory' },
    seal: { url: '' }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '', errors: [] });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/business/profile');
        const biz = res.data.data.business;
        setForm({
          name: biz.name || '',
          ownerName: biz.ownerName || '',
          tagline: biz.tagline || '',
          address: biz.address || '',
          city: biz.city || '',
          state: biz.state || '',
          pinCode: biz.pinCode || '',
          country: biz.country || 'India',
          gstin: biz.gstin || '',
          pan: biz.pan || '',
          phone: biz.phone || '',
          alternatePhone: biz.alternatePhone || '',
          email: biz.email || '',
          website: biz.website || '',
          logoUrl: biz.logoUrl || '',
          bankDetails: {
            bankName: biz.bankDetails?.bankName || '',
            accountNumber: biz.bankDetails?.accountNumber || '',
            ifsc: biz.bankDetails?.ifsc || '',
            branchName: biz.bankDetails?.branchName || '',
            accountName: biz.bankDetails?.accountName || ''
          },
          invoiceSettings: {
            prefix: biz.invoiceSettings?.prefix || 'INV-',
            defaultDueDays: biz.invoiceSettings?.defaultDueDays ?? 7,
            notes: biz.invoiceSettings?.notes || ''
          },
          signature: {
            url: biz.signature?.url || '',
            signerName: biz.signature?.signerName || biz.ownerName || '',
            designation: biz.signature?.designation || 'Authorized Signatory'
          },
          seal: {
            url: biz.seal?.url || ''
          }
        });
      } catch {
        setMessage({ text: 'Failed to load business profile.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Auto-uppercase GSTIN and PAN for user convenience
    const formattedValue = (name === 'gstin' || name === 'pan') ? value.toUpperCase() : value;
    setForm(prev => ({ ...prev, [name]: formattedValue }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleNestedChange = (section, field, value) => {
    // Auto-uppercase IFSC
    const formattedValue = (section === 'bankDetails' && field === 'ifsc') ? value.toUpperCase() : value;
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: formattedValue }
    }));
    const fullPath = `${section}.${field}`;
    if (fieldErrors[fullPath]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[fullPath];
        return next;
      });
    }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Signature file must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setForm(prev => ({
        ...prev,
        signature: {
          ...prev.signature,
          url: event.target.result
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSealUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Company seal file must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setForm(prev => ({
        ...prev,
        seal: {
          ...prev.seal,
          url: event.target.result
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearSignature = () => {
    setForm(prev => ({
      ...prev,
      signature: {
        ...prev.signature,
        url: ''
      }
    }));
  };

  const handleClearSeal = () => {
    setForm(prev => ({
      ...prev,
      seal: {
        ...prev.seal,
        url: ''
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '', errors: [] });
    try {
      await api.patch('/business/profile', form);
      setMessage({ text: 'Profile updated successfully!', type: 'success', errors: [] });
      setFieldErrors({});
    } catch (err) {
      const fieldMap = extractFieldErrors(err);
      setFieldErrors(fieldMap);
      const msg = formatApiError(err, 'Update failed.');
      const errList = Array.isArray(err.response?.data?.errors) ? err.response.data.errors : [];
      setMessage({ text: msg, type: 'error', errors: errList });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Profile & Billing Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your legal business identity, GST registration, bank details, and invoice defaults.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 text-sm ${
          message.type === 'error'
            ? 'bg-rose-50 text-rose-800 border border-rose-200/80'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
        }`}>
          {message.type === 'error' ? (
            <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
          )}
          <div>
            <div className="font-semibold">
              {message.type === 'error' ? 'Validation Error' : 'Success'}
            </div>
            <p className="mt-0.5 text-xs">{message.text}</p>
            {message.errors && message.errors.length > 1 && (
              <ul className="mt-2 list-disc list-inside text-xs space-y-1 text-rose-700">
                {message.errors.map((err, idx) => (
                  <li key={idx}>
                    {err.path ? <strong className="font-medium">{err.path}: </strong> : null}
                    {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Business Details */}
        <div className="bg-white shadow-xs border border-slate-200/90 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Legal Entity & Tax Credentials</h2>
              <p className="text-xs text-slate-500">Business trade name, GSTIN, PAN, and primary contact info</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Business Trade / Legal Name *"
              name="name"
              value={form.name}
              onChange={handleChange}
              error={fieldErrors['name']}
              placeholder="e.g. RAJESH BOREWELL"
              required
            />
            <Input
              label="Owner / Proprietor Name"
              name="ownerName"
              value={form.ownerName}
              onChange={handleChange}
              error={fieldErrors['ownerName']}
              placeholder="e.g. Rajesh Jha"
            />
            <div className="md:col-span-2">
              <Input
                label="Tagline / Business Specialization"
                name="tagline"
                value={form.tagline}
                onChange={handleChange}
                error={fieldErrors['tagline']}
                placeholder="e.g. Spl. in : Borwell Motor Repairing & Sales of All Types of Borwell Motors & Spare Parts"
              />
            </div>
            <Input
              label="Primary Contact Phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="e.g. 9321595520"
              error={fieldErrors['phone']}
            />
            <Input
              label="Alternate Phone / Contact"
              name="alternatePhone"
              value={form.alternatePhone}
              onChange={handleChange}
              placeholder="e.g. Deonarayan Jha 9423357405"
              error={fieldErrors['alternatePhone']}
            />
            <Input
              label="Official Email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="billing@yourdomain.com"
              error={fieldErrors['email']}
            />
            <Input
              label="Website"
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="https://www.yourdomain.com"
              error={fieldErrors['website']}
            />
            <Input
              label="GSTIN (15 Digits)"
              name="gstin"
              value={form.gstin}
              onChange={handleChange}
              placeholder="22AAAAA0000A1Z5"
              error={fieldErrors['gstin']}
            />
            <Input
              label="Income Tax PAN (10 Digits)"
              name="pan"
              value={form.pan}
              onChange={handleChange}
              placeholder="AAAAA0000A"
              error={fieldErrors['pan']}
            />
          </div>
        </div>

        {/* Section 2: Address */}
        <div className="bg-white shadow-xs border border-slate-200/90 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Principal Place of Business</h2>
              <p className="text-xs text-slate-500">Registered address printed on the invoice header</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Registered Street Address"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Building, street, landmark"
                error={fieldErrors['address']}
              />
            </div>
            <Input
              label="City"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="City"
              error={fieldErrors['city']}
            />
            <Input
              label="State / Province"
              name="state"
              value={form.state}
              onChange={handleChange}
              placeholder="State name"
              error={fieldErrors['state']}
            />
            <Input
              label="PIN Code"
              name="pinCode"
              value={form.pinCode}
              onChange={handleChange}
              placeholder="6-digit postal PIN"
              error={fieldErrors['pinCode']}
            />
            <Input
              label="Country"
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="India"
              error={fieldErrors['country']}
            />
          </div>
        </div>

        {/* Section 3: Bank Details */}
        <div className="bg-white shadow-xs border border-slate-200/90 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Bank & NEFT/RTGS Settlement Details</h2>
              <p className="text-xs text-slate-500">Bank credentials shown on the PDF invoice footer for wire transfers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Bank Name"
              value={form.bankDetails.bankName}
              onChange={e => handleNestedChange('bankDetails', 'bankName', e.target.value)}
              placeholder="e.g. State Bank of India or HDFC Bank"
              error={fieldErrors['bankDetails.bankName']}
            />
            <Input
              label="Bank Account Number"
              value={form.bankDetails.accountNumber}
              onChange={e => handleNestedChange('bankDetails', 'accountNumber', e.target.value)}
              placeholder="e.g. 50100023456789"
              error={fieldErrors['bankDetails.accountNumber']}
            />
            <Input
              label="IFSC Code (11 characters)"
              value={form.bankDetails.ifsc}
              onChange={e => handleNestedChange('bankDetails', 'ifsc', e.target.value)}
              placeholder="HDFC0001234"
              error={fieldErrors['bankDetails.ifsc']}
            />
            <Input
              label="Branch Name"
              value={form.bankDetails.branchName}
              onChange={e => handleNestedChange('bankDetails', 'branchName', e.target.value)}
              placeholder="e.g. Nariman Point, Mumbai"
              error={fieldErrors['bankDetails.branchName']}
            />
            <div className="md:col-span-2">
              <Input
                label="Account Beneficiary Name"
                value={form.bankDetails.accountName}
                onChange={e => handleNestedChange('bankDetails', 'accountName', e.target.value)}
                placeholder="Beneficiary name exactly as in bank account"
                error={fieldErrors['bankDetails.accountName']}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Invoice Settings */}
        <div className="bg-white shadow-xs border border-slate-200/90 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Invoice Series & Terms Defaults</h2>
              <p className="text-xs text-slate-500">Invoice numbering sequence and boilerplate conditions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Invoice Number Prefix"
              value={form.invoiceSettings.prefix}
              onChange={e => handleNestedChange('invoiceSettings', 'prefix', e.target.value)}
              placeholder="INV-"
              error={fieldErrors['invoiceSettings.prefix']}
            />
            <Input
              label="Default Payment Grace Days"
              type="number"
              min="0"
              max="365"
              value={form.invoiceSettings.defaultDueDays}
              onChange={e => handleNestedChange('invoiceSettings', 'defaultDueDays', parseInt(e.target.value) || 0)}
              placeholder="7"
              error={fieldErrors['invoiceSettings.defaultDueDays']}
            />
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">Standard Terms & Conditions</label>
              <textarea
                rows="3"
                value={form.invoiceSettings.notes}
                onChange={e => handleNestedChange('invoiceSettings', 'notes', e.target.value)}
                placeholder="1. Goods once sold will not be taken back.&#10;2. Interest @ 18% per annum will be charged on overdue payments."
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Brand Logo */}
        <div className="bg-white shadow-xs border border-slate-200/90 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Branding & Logo URL</h2>
              <p className="text-xs text-slate-500">Provide a high-resolution PNG or SVG URL for your invoice header</p>
            </div>
          </div>

          <div>
            <Input
              label="Logo Direct Image URL"
              name="logoUrl"
              value={form.logoUrl}
              onChange={handleChange}
              placeholder="https://example.com/logo.png"
              error={fieldErrors['logoUrl']}
            />
          </div>
        </div>

        {/* Section 6: Authorized Signature & Company Seal */}
        <div className="bg-white shadow-xs border border-slate-200/90 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Authorized Signature & Company Seal (Multi-User)</h2>
              <p className="text-xs text-slate-500">Provide official authorized signature and rubber stamp to prove genuine authenticity & integrity</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Signer credentials */}
            <Input
              label="Authorized Signer Full Name"
              value={form.signature.signerName}
              onChange={e => handleNestedChange('signature', 'signerName', e.target.value)}
              placeholder={form.ownerName || "e.g. Rajesh Kumar"}
              error={fieldErrors['signature.signerName']}
            />

            <Input
              label="Signer Designation / Title"
              value={form.signature.designation}
              onChange={e => handleNestedChange('signature', 'designation', e.target.value)}
              placeholder="e.g. Proprietor, Director, Partner, Authorized Signatory"
              error={fieldErrors['signature.designation']}
            />

            {/* Signature Upload Area */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Authorized Signature Image
              </label>
              <p className="text-[11px] text-slate-500 mb-3">
                Scanned signature or transparent PNG (max 2MB)
              </p>

              {form.signature.url ? (
                <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-200">
                  <div className="w-32 h-14 bg-slate-50 rounded border border-slate-100 flex items-center justify-center p-1 overflow-hidden">
                    <img
                      src={form.signature.url}
                      alt="Signature Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Signature Uploaded
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSignature}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium block"
                    >
                      Remove / Change
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Signature Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-1.5">If left empty, system generates a stylized digital signature automatically.</span>
                </div>
              )}
            </div>

            {/* Company Seal Upload Area */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Official Company Seal / Stamp
              </label>
              <p className="text-[11px] text-slate-500 mb-3">
                Scanned round/oval rubber stamp (max 2MB)
              </p>

              {form.seal.url ? (
                <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-200">
                  <div className="w-16 h-16 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center p-1 overflow-hidden">
                    <img
                      src={form.seal.url}
                      alt="Seal Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Stamp Uploaded
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSeal}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium block"
                    >
                      Remove / Change
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Company Seal
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSealUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-1.5">If left empty, system provides an official circular digital seal.</span>
                </div>
              )}
            </div>

            {/* Live Preview on Invoices */}
            <div className="md:col-span-2 border border-indigo-100 rounded-xl p-5 bg-indigo-50/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-1">
                Live Document Signature Preview
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">
                This is exactly how your authorized signature, credentials, and authenticity badge will appear on customer bills & receipts:
              </p>

              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs max-w-md ml-auto">
                <p className="text-xs font-bold text-slate-900 text-right">For {form.name || 'Your Business Name'}</p>
                <div className="h-16 flex items-center justify-end gap-3 my-1">
                  {form.seal.url ? (
                    <img
                      src={form.seal.url}
                      alt="Seal Preview"
                      className="w-14 h-14 object-contain rounded-full border border-blue-200 p-0.5"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-indigo-200 bg-indigo-50 flex flex-col items-center justify-center text-center p-1 select-none">
                      <span className="text-[7px] font-extrabold uppercase tracking-widest text-indigo-700 leading-none">OFFICIAL</span>
                      <span className="text-[6.5px] font-bold text-slate-500 mt-0.5 leading-none">SEAL</span>
                    </div>
                  )}

                  {form.signature.url ? (
                    <img
                      src={form.signature.url}
                      alt="Signature Preview"
                      className="max-h-12 max-w-[150px] object-contain"
                    />
                  ) : (
                    <div className="font-['Brush_Script_MT',cursive,'Caveat',serif] text-2xl text-indigo-950 italic tracking-wider select-none px-2 py-1 transform -rotate-1">
                      {form.signature.signerName || form.ownerName || 'Authorized Signatory'}
                    </div>
                  )}
                </div>

                <div className="w-48 border-t border-slate-300 pt-1 text-right ml-auto">
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {form.signature.signerName || form.ownerName || 'Authorized Signatory'}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                    {form.signature.designation || 'Authorized Signatory'}
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1 text-[9px] font-semibold text-emerald-700">
                    <svg className="w-2.5 h-2.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Digitally Signed & System Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            size="md"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            }
          >
            {saving ? 'Saving Profile...' : 'Save Business Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default BusinessProfilePage;
