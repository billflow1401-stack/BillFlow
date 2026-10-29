# BillFlow-Pro Backend

This is the Node.js / Express API for BillFlow-Pro.

## Overview

This is the Node.js / Express REST API for BillFlow-Pro, connected to MongoDB Atlas.

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
