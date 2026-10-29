# BillFlow-Pro

BillFlow-Pro is a high-performance, tenant-isolated B2B SaaS application designed to manage invoices, inventory, taxes, and customer relationships. It features robust GST support, real-time validations, and automatic PDF generation.

## Project Structure

This repository is organized as a monorepo containing:

- **frontend/**: The React/Vite Single Page Application (SPA).
- **backend/**: The Node.js/Express API.

## Production Deployment

This application is fully production-ready. All instructions regarding environment variables, architecture, security, and startup commands have been consolidated into the deployment guide.

**➡️ Please refer to the [DEPLOYMENT.md](./DEPLOYMENT.md) guide for all production setup and configuration instructions.**

## Development

For local development setup, refer to the respective directory documentation or follow the standard `npm install` and `npm run dev` / `npm start` commands in each directory.

- Frontend runs on `http://localhost:5173`
- Backend runs on `http://localhost:5000`

## Features

- **Strict Tenant Isolation**: All data is segmented per business.
- **Robust GST Calculation**: Accurate tax logic, including intra/inter-state rules.
- **Inventory Management**: Real-time stock ledgers tied to invoicing.
- **Performance**: High-efficiency backend utilizing targeted MongoDB aggregations and indexing.
- **Security**: Hardened JWT authentication, strict CORS, and CSP/HSTS.
