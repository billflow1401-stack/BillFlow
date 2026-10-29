# BillFlow-Pro: Production Deployment Guide

This document outlines the architecture, configuration, and exact steps required to deploy BillFlow-Pro to a production environment.

## 1. Production Architecture

The application consists of three main components:
- **Frontend**: A static Single Page Application (React/Vite). Must be hosted on a CDN or static web host (e.g., Vercel, Netlify, Nginx) capable of SPA fallback routing.
- **Backend**: A Node.js Express REST API. Must be run as a persistent background process (e.g., Docker, Heroku, Render, PM2).
- **Database**: MongoDB Atlas.

## 2. Environment Variables

All configuration is controlled via environment variables. The backend enforces strict validation on startup; if required variables are missing or invalid, the process will fail to start (`process.exit(1)`).

### Backend (`.env`)

| Variable | Required | Type / Rule | Description |
|----------|----------|-------------|-------------|
| `NODE_ENV` | **Yes** | `production` | Enforces production mode and disables stack traces. |
| `PORT` | No | Number (e.g., `5000`) | The port the HTTP server binds to. |
| `MONGO_URI` | **Yes** | MongoDB URL | Full MongoDB Atlas connection string. |
| `JWT_SECRET` | **Yes** | String (≥32 chars) | Secret key for JWT signing. Must be securely generated. |
| `CORS_ORIGIN` | **Yes** | URL (http/https) | The exact frontend URL (e.g., `https://my-app.com`). Wildcards (`*`) are strictly blocked in production. |

### Frontend (`.env` or Build Environment)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | The full URL pointing to the production backend API (e.g., `https://api.my-app.com/api/v1`). If omitted, it falls back to `http://localhost:5000/api/v1` which is **NOT** suitable for production. |

## 3. Frontend Deployment

The frontend must be built before deployment. It does NOT require Node.js at runtime.

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Build for production:**
   Ensure `VITE_API_URL` is set in your build environment.
   ```bash
   npm run build
   ```
3. **Deploy:**
   Host the output `dist/` directory on any static host.
4. **SPA Routing Requirement:**
   You MUST configure the web server/CDN to route all 404 errors (or all traffic) back to `index.html`. 
   - **Nginx example**: `try_files $uri $uri/ /index.html;`
   - **Vercel/Netlify**: Typically requires a `vercel.json` or `_redirects` file setting `/* /index.html 200`.

## 4. Backend Deployment

The backend is a stateful Node.js application.

1. **Install dependencies:**
   ```bash
   npm install --omit=dev
   ```
2. **Configure Environment:**
   Ensure the production environment variables defined in Section 2 are securely provided.
3. **Start the server:**
   ```bash
   npm start
   ```

*Note: The backend gracefully handles `SIGTERM` by stopping HTTP connections and cleanly closing the MongoDB connection.*

## 5. Security & Safety Notes

- **Fail-Closed Design:** The backend explicitly refuses to start if `JWT_SECRET` is less than 32 characters in production, or if `CORS_ORIGIN` contains a wildcard.
- **Error Handling:** In `NODE_ENV=production`, internal stack traces are automatically scrubbed from API responses.
- **MongoDB Atlas:** Ensure your MongoDB Atlas Network Access (IP Whitelist) permits connections from your backend hosting provider.

## 6. Health & Readiness

The backend provides a health check endpoint useful for load balancers or monitoring:
```
GET /api/v1/health
```
It returns an HTTP 200 and the live status of the MongoDB connection.
