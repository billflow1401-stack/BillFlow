const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 0;
let BASE;
const uid = Date.now();

test('Phase 17 — Search, Filtering, and Validation', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);
  BASE = `http://localhost:${server.address().port}/api/v1`;

  try {
    // 1. Setup Businesses and Tokens
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User 17', email: `user17_${uid}@test.com`, password: 'password', businessName: 'Biz 17' })
    });
    const regData = await regRes.json();
    const token = regData.data.token;
    
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // 2. Setup Customers
    await fetch(`${BASE}/customers`, { method: 'POST', headers, body: JSON.stringify({ name: 'Alpha Business', customerType: 'Business' }) });
    await fetch(`${BASE}/customers`, { method: 'POST', headers, body: JSON.stringify({ name: 'Beta Individual', customerType: 'Individual' }) });

    // Customer Validation & Search
    await t.test('Customer query validation - invalid sort field', async () => {
      const res = await fetch(`${BASE}/customers?sort=invalidField`, { headers });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.errors.find(e => e.path === 'sort'));
    });

    await t.test('Customer query validation - unknown parameter', async () => {
      const res = await fetch(`${BASE}/customers?unknown=1`, { headers });
      assert.strictEqual(res.status, 400);
    });

    await t.test('Customer search and pagination', async () => {
      const res = await fetch(`${BASE}/customers?search=Alpha`, { headers });
      const data = await res.json();
      assert.strictEqual(data.data.customers.length, 1);
      assert.strictEqual(data.data.customers[0].name, 'Alpha Business');
      assert.ok(data.data.pagination);
      assert.strictEqual(data.data.pagination.total, 1);
    });

    await t.test('Customer filter by type', async () => {
      const res = await fetch(`${BASE}/customers?customerType=Individual`, { headers });
      const data = await res.json();
      assert.strictEqual(data.data.customers.length, 1);
      assert.strictEqual(data.data.customers[0].name, 'Beta Individual');
    });

    // 3. Setup Items
    await fetch(`${BASE}/items`, { method: 'POST', headers, body: JSON.stringify({ name: 'Alpha Product', sku: 'SKU-A', type: 'Product', unitPrice: 1000, isActive: true }) });
    await fetch(`${BASE}/items`, { method: 'POST', headers, body: JSON.stringify({ name: 'Beta Service', sku: 'SKU-B', type: 'Service', unitPrice: 2000, isActive: false }) });

    await t.test('Item query validation - invalid isActive string', async () => {
      const res = await fetch(`${BASE}/items?isActive=yes`, { headers });
      assert.strictEqual(res.status, 400);
    });

    await t.test('Item filter and search', async () => {
      const res = await fetch(`${BASE}/items?type=Service&isActive=false`, { headers });
      const data = await res.json();
      assert.strictEqual(data.data.items.length, 1);
      assert.strictEqual(data.data.items[0].name, 'Beta Service');
    });

    // 4. Invoices Validation & Search
    // Since creating an invoice requires actual item ids and customer ids, we will just test validation logic on empty state or simple parameters.
    await t.test('Invoice query validation - valid dates', async () => {
      const res = await fetch(`${BASE}/invoices?startDate=2024-01-01&endDate=2024-12-31`, { headers });
      assert.strictEqual(res.status, 200);
    });

    await t.test('Invoice query validation - invalid dates', async () => {
      const res = await fetch(`${BASE}/invoices?startDate=01-01-2024`, { headers });
      assert.strictEqual(res.status, 400);
    });

    await t.test('Invoice query validation - sort & pagination', async () => {
      const res = await fetch(`${BASE}/invoices?sort=grandTotal&order=asc&page=2&limit=5`, { headers });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.pagination.page, 2);
      assert.strictEqual(data.data.pagination.limit, 5);
    });

  } finally {
    server.close();
    await mongoose.connection.close();
  }
});
