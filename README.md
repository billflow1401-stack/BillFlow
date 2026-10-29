# BillFlow-Pro

BillFlow-Pro is a high-performance, tenant-isolated B2B SaaS application designed to manage invoices, inventory, taxes, and customer relationships. It features robust GST support, real-time validations, and automatic PDF generation.

## Project Structure

This repository is organized as a monorepo containing:

- **frontend/**: The React/Vite Single Page Application (SPA).
- **backend/**: The Node.js/Express API.

## Production Deployment

BillFlow-Pro is deployed and hosted on Render:
- **Frontend SPA**: https://billflow-frontend-xsox.onrender.com
- **Backend API**: https://billflow-backend-ehym.onrender.com

The application uses hybrid client-side URL detection: accessing it via `localhost` automatically routes to your local backend, while accessing it on Render routes to the production API.

## Development

- Frontend dev server: `npm run dev` (runs on `http://localhost:5173`)
- Backend server: `npm start` (runs on `http://localhost:5000`)

## Features

- **Strict Tenant Isolation**: All data is segmented per business.
- **Robust GST Calculation**: Accurate tax logic, including intra/inter-state rules.
- **Inventory Management**: Real-time stock ledgers tied to invoicing.
- **Performance**: High-efficiency backend utilizing targeted MongoDB aggregations and indexing.
- **Security**: Hardened JWT authentication, strict CORS, and CSP/HSTS.
