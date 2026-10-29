# BillFlow-Pro: Project Demonstration & Architecture Guide

## 1. Problem Statement
Managing GST compliance, invoicing, and inventory tracking simultaneously is a significant burden for Indian MSMEs. Traditional solutions are often overly complex, rely on desktop software, or lack real-time validation, leading to tax filing errors.

## 2. Project Objectives
- **Simplify GST Billing:** Provide a fast, web-based SPA to generate accurate GST invoices.
- **Ensure Tax Accuracy:** Automatically determine CGST/SGST vs IGST based on the customer's location.
- **Automate Ledgers:** Tie invoice generation directly to inventory depletion and payment tracking.
- **Provide Safe Multi-Tenancy:** Allow multiple independent businesses to use the platform securely with strict data isolation.

## 3. Technology Stack
- **Frontend:** React 19, Vite, Tailwind CSS, React Router.
- **Backend:** Node.js (v20+), Express.js.
- **Database:** MongoDB (Atlas), Mongoose ODM.
- **Testing:** Node.js native test runner (`node:test`), Supertest.

## 4. Key Architectural Highlights (Verified in Code)

### A. Stateless Authentication & Security
- **JWT Architecture:** The system uses stateless JSON Web Tokens (JWT) signed with a strict ≥32 character HS256 secret.
- **Fail-Closed Security:** The backend explicitly refuses to start in production if the `JWT_SECRET` is weak or if `CORS_ORIGIN` contains wildcards.
- **API Hardening:** `Helmet` enforces strict CSP and HSTS. `express-rate-limit` prevents brute-force API abuse.

### B. Business / Tenant Isolation
- **Strict Partitioning:** Every primary schema (`Invoice`, `Customer`, `Item`, `TaxConfig`) requires a mandatory indexed `businessId`.
- **Query Safeguards:** API controllers automatically inject the authenticated user's `businessId` into every MongoDB query filter, mathematically preventing cross-tenant data leakage.

### C. GST & Tax Engine Behavior
- **Centralized Engine:** Taxes are computed in a centralized `calculateGST` engine using precise integer math (paise) to avoid floating-point errors.
- **Dynamic Supply Type:** The system compares the Business state with the Customer state. If they match, `CGST` & `SGST` are applied. If they differ, `IGST` is applied.
- **Taxonomy Linkage:** Items are linked to HSN/SAC codes. If an item lacks a mandatory tax configuration during calculation, the system explicitly requires it or falls back safely to 0% NON-GST.

### D. Invoice Finalization & MongoDB Transactions
- **Draft vs Final:** Invoices are created as mutable "Drafts" with temporary IDs. 
- **Atomic Operations:** Clicking "Finalize" triggers an atomic MongoDB Transaction (`session.withTransaction`). This safely allocates the sequential invoice number (e.g., `INV-0001`), locks the invoice as "Unpaid", and simultaneously deducts the required inventory.
- **Idempotency:** The backend gracefully handles concurrent clicks; if an invoice is already finalized, it returns the existing document without deducting inventory twice.

### E. PDF Generation Architecture
- **In-Memory Rendering:** Invoice PDFs are generated entirely in memory using the `pdfmake` library.
- **Zero Disk I/O:** PDF buffers are streamed directly to the HTTP response (`responseType: 'blob'`). This prevents orphaned files, ensures concurrency safety, and simplifies containerized deployment.

### F. Inventory & Reporting Behavior
- **Stock Automation:** Adjusting inventory creates `StockMovement` ledger entries.
- **Data Aggregation:** The Dashboard and Reports heavily utilize MongoDB Aggregation Pipelines to sum taxable values and GST separated by rate and HSN, offloading computational work to the database.

## 5. Testing & Production Readiness
- **Test Coverage:** The repository contains a comprehensive suite of 128 automated integration tests covering the GST engine, precision rounding, and API workflows.
- **Production Built:** The frontend is optimized via Vite code-splitting, and the backend suppresses stack traces and debug logging when `NODE_ENV=production`.

## 6. Known Limitations (Future Scope)
- **Email Delivery:** Invoices currently download directly; automated email dispatch is not yet implemented.
- **Analytics:** Reporting is currently limited to tabular GST aggregates and simple time-series dashboards. Advanced predictive analytics are a future enhancement.
