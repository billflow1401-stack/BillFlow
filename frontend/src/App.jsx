import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BusinessProfilePage = lazy(() => import('./pages/BusinessProfilePage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ItemsPage = lazy(() => import('./pages/ItemsPage'));
const TaxConfigPage = lazy(() => import('./pages/TaxConfigPage'));
const InvoiceCreatePage = lazy(() => import('./pages/InvoiceCreatePage'));
const InvoiceViewPage = lazy(() => import('./pages/InvoiceViewPage'));
const InvoiceHistoryPage = lazy(() => import('./pages/InvoiceHistoryPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const Reports = lazy(() => import('./pages/Reports'));
const SalesReport = lazy(() => import('./pages/SalesReport'));
const GSTReport = lazy(() => import('./pages/GSTReport'));
const InvoiceVerificationPage = lazy(() => import('./pages/InvoiceVerificationPage'));
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center text-gray-500">Loading...</div>}>
          <Routes>
            {/* Public Online Verification Portal (Accessible by anyone, QR scanning, auditors) */}
            <Route path="/verify" element={<InvoiceVerificationPage />} />
            <Route path="/verify/:code" element={<InvoiceVerificationPage />} />

            {/* Auth Pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Application Shell Pages */}
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
            <Route path="/business-profile" element={<ProtectedRoute><AppLayout><BusinessProfilePage /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<Navigate to="/business-profile" replace />} />
            <Route path="/customers" element={<ProtectedRoute><AppLayout><CustomersPage /></AppLayout></ProtectedRoute>} />
            <Route path="/items" element={<ProtectedRoute><AppLayout><ItemsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/tax-config" element={<ProtectedRoute><AppLayout><TaxConfigPage /></AppLayout></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><AppLayout><InvoiceHistoryPage /></AppLayout></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><AppLayout><InventoryPage /></AppLayout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
            <Route path="/reports/sales" element={<ProtectedRoute><AppLayout><SalesReport /></AppLayout></ProtectedRoute>} />
            <Route path="/reports/gst" element={<ProtectedRoute><AppLayout><GSTReport /></AppLayout></ProtectedRoute>} />
            
            {/* Standalone / Document Pages */}
            <Route path="/invoices/new" element={<ProtectedRoute><InvoiceCreatePage /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceViewPage /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
