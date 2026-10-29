# BillFlow-Pro Backend

This is the Node.js / Express API for BillFlow-Pro.

## Production Deployment

All production deployment instructions, environment variable configurations, security constraints, and database connectivity requirements are documented in the root deployment guide.

**➡️ Please refer to the [DEPLOYMENT.md](../DEPLOYMENT.md) guide at the root of the repository.**

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment (copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   ```

3. Start the server (binds to port 5000 by default):
   ```bash
   npm start
   ```

4. Run automated tests (uses native `node:test` runner):
   ```bash
   npm test
   ```
