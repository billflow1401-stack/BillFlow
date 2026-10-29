const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5018;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;

test('Phase 12 — Invoice History Integration', async (t) => {
  await mongoose.connect(env.mongoUri);
  let server;
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });

  let userA, userB;
  let customerId, itemId, taxConfigId, invoiceId;
  const uid = Date.now();

  try {
    // 1. Setup users and data
    const resA = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: 'History Business A', name: 'User A', email: `history_a_${uid}@test.com`, password: 'password123' })
    });
    userA = (await resA.json()).data;

    const resB = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: 'History Business B', name: 'User B', email: `history_b_${uid}@test.com`, password: 'password123' })
    });
    userB = (await resB.json()).data;

    // Create Customer
    const custRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'History Customer', email: 'hist@test.com', gstin: '27AAAAA0000A1Z5' })
    });
    customerId = (await custRes.json()).data.customer._id;

    // Create Tax Config
    const taxRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '1234', description: 'desc', classificationType: 'SAC', gstRate: 18 })
    });
    taxConfigId = (await taxRes.json()).data.taxConfig._id;

    // Create Item
    const itemRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'History Service', type: 'Service', unitPrice: 100000, hsnSac: '1234' })
    });
    itemId = (await itemRes.json()).data.item._id;

    // Create multiple invoices for pagination test
    const invoiceIds = [];
    for (let i = 0; i < 5; i++) {
      const invRes = await fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ customerId, date: new Date().toISOString(), items: [{ itemId, quantity: 1 }] })
      });
      const id = (await invRes.json()).data.invoice._id;
      invoiceIds.push(id);
    }
    invoiceId = invoiceIds[0];

    // Finalize the first one
    await fetch(`${BASE}/invoices/${invoiceId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });

    // Create one invoice for User B
    const custResB = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ name: 'History Customer B', email: 'histB@test.com', gstin: '27AAAAA0000A1Z5' })
    });
    const customerIdB = (await custResB.json()).data.customer._id;

    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ hsnSac: '1234', description: 'desc', classificationType: 'SAC', gstRate: 18 })
    });

    const itemResB = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ name: 'History Service B', type: 'Service', unitPrice: 100000, hsnSac: '1234' })
    });
    const itemIdB = (await itemResB.json()).data.item._id;

    await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ customerId: customerIdB, date: new Date().toISOString(), items: [{ itemId: itemIdB, quantity: 1 }] })
    });

    await t.test('Reject unauthenticated history request', async () => {
      const res = await fetch(`${BASE}/invoices`);
      assert.strictEqual(res.status, 401);
    });

    await t.test('Enforce business isolation in history', async () => {
      const res = await fetch(`${BASE}/invoices`, {
        headers: { Authorization: `Bearer ${userB.token}` }
      });
      const body = await res.json();
      assert.strictEqual(body.data.invoices.length, 1);
      assert.ok(!body.data.invoices.find(inv => inv._id === invoiceId));
    });

    await t.test('Pagination: default limits and values', async () => {
      const res = await fetch(`${BASE}/invoices`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      const body = await res.json();
      assert.strictEqual(body.data.invoices.length, 5);
      assert.strictEqual(body.data.pagination.total, 5);
      assert.strictEqual(body.data.pagination.page, 1);
      assert.strictEqual(body.data.pagination.limit, 20);
    });

    await t.test('Pagination: valid page and limit', async () => {
      const res = await fetch(`${BASE}/invoices?page=2&limit=2`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      const body = await res.json();
      assert.strictEqual(body.data.invoices.length, 2);
      assert.strictEqual(body.data.pagination.page, 2);
      assert.strictEqual(body.data.pagination.limit, 2);
      assert.strictEqual(body.data.pagination.totalPages, 3);
    });

    await t.test('Pagination: maximum limit enforcement returns 400', async () => {
      const res = await fetch(`${BASE}/invoices?limit=500`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert.strictEqual(res.status, 400);
    });

    await t.test('Pagination: invalid parameters return 400', async () => {
      const res = await fetch(`${BASE}/invoices?page=invalid&limit=-5`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert.strictEqual(res.status, 400);
    });

    await t.test('Deterministic ordering', async () => {
      const res = await fetch(`${BASE}/invoices`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      const body = await res.json();
      // Should be newest first. We created them sequentially.
      // So index 0 should be the LAST created invoice.
      const lastInvoiceId = invoiceIds[4];
      assert.strictEqual(body.data.invoices[0]._id, lastInvoiceId);
    });

    await t.test('Historical Immutability (Master Data Change)', async () => {
      // 1. Finalized invoice exists (invoiceId is finalized)
      // 2. Modify live Customer
      await fetch(`${BASE}/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ name: 'Changed Customer Name' })
      });

      // 3. Modify live Item
      await fetch(`${BASE}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ name: 'Changed Service', unitPrice: 200000 })
      });

      // 4. Modify live TaxConfig
      await fetch(`${BASE}/tax-config/${taxConfigId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ gstRate: 28 })
      });

      // 5. Retrieve Invoice History
      const res = await fetch(`${BASE}/invoices`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      const body = await res.json();

      const targetInvoice = body.data.invoices.find(inv => inv._id === invoiceId);

      // Verify historical invoice information remains unchanged
      assert.strictEqual(targetInvoice.customerSnapshot.name, 'History Customer');
      assert.strictEqual(targetInvoice.summary.taxableTotal, '100000.00');
      assert.strictEqual(targetInvoice.summary.taxTotal, '18000.00');
      assert.strictEqual(targetInvoice.summary.grandTotal, '118000.00');

      // Verify projections exclude large fields
      assert.strictEqual(targetInvoice.items, undefined);
      assert.strictEqual(targetInvoice.businessSnapshot, undefined);
    });

  } finally {
    server.close();
    await mongoose.connection.close();
  }
});
