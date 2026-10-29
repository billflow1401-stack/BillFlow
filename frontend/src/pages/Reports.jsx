import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';

const Reports = () => {
  const navigate = useNavigate();
  return (
    <div className="pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Financial Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Audit-ready sales analytics, revenue realization, and statutory GST compliance filing reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 sm:p-7 flex flex-col justify-between h-full bg-white border border-slate-200/90 shadow-xs hover:border-indigo-200 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Sales & Revenue Performance</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Track your business's total invoiced billing, collected payments, outstanding balances, and gross margins across customizable date ranges.
            </p>
            <div className="space-y-2 mb-6 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Total invoice counts and taxable totals</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Collection vs. balance due metrics</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Custom date range filtering up to 12 months</span>
              </div>
            </div>
          </div>
          <Button
            className="w-full justify-center"
            size="md"
            onClick={() => navigate('/reports/sales')}
          >
            Open Sales Report &rarr;
          </Button>
        </Card>

        <Card className="p-6 sm:p-7 flex flex-col justify-between h-full bg-white border border-slate-200/90 shadow-xs hover:border-indigo-200 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Statutory GST Filing Summary</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Access comprehensive GST summaries, CGST/SGST/IGST tax splits, rate-wise slabs, and HSN/SAC-wise tax aggregations required for GSTR-1 and GSTR-3B filings.
            </p>
            <div className="space-y-2 mb-6 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Total Tax split by CGST, SGST, and IGST</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Tax slab breakdown (0%, 5%, 12%, 18%, 28%)</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>HSN/SAC-wise paginated audit table</span>
              </div>
            </div>
          </div>
          <Button
            className="w-full justify-center"
            size="md"
            onClick={() => navigate('/reports/gst')}
          >
            Open GST Report &rarr;
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
