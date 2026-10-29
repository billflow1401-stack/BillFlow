const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

// Fix DNS for local testing if needed
if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

let BASE = `http://localhost:${env.port}/api/v1`;
const uid = Date.now();

let server;

describe('Phase 15 — Dashboard', () => {
  let userA, userB;
  let prodA, svcB;
  let custA, custB;
  let taxA;

  before(async () => {
    await mongoose.connect(env.mongoUri);
    // Removed dropDatabase() to prevent interference with concurrent test files

    await new Promise((resolve, reject) => {
      server = app.listen(0, () => {
        BASE = `http://localhost:${server.address().port}/api/v1`;
        resolve();
      });
      server.on('error', reject);
    });

    // Create Business A
    const resA = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A', email: `a_${uid}@test.com`, password: 'password123', businessName: 'Biz A' })
    });
    userA = (await resA.json()).data;

    // Create Business B
    const resB = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B', email: `b_${uid}@test.com`, password: 'password123', businessName: 'Biz B' })
    });
    userB = (await resB.json()).data;

    // Tax Config A
    const tA = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '1234', classificationType: 'HSN', gstRate: 18, taxTreatment: 'TAXABLE' })
    });
    taxA = (await tA.json()).data.taxConfig;

    // Cust A
    const cA = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Cust A', customerType: 'Individual', state: 'Maharashtra', billingAddress: '123 MG Road, Mumbai' })
    });
    custA = (await cA.json()).data.customer;

    // Cust B
    const cB = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ name: 'Cust B', customerType: 'Individual', state: 'Delhi', billingAddress: '456 Ring Road, Delhi' })
    });
    custB = (await cB.json()).data.customer;

    // Item A (Product, low stock)
    const iA = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Prod A', type: 'Product', unitPrice: 100000, hsnSac: '1234', sku: 'SKU1' }) // 1000 INR
    });
    prodA = (await iA.json()).data.item;

    // Adjust stock to 2 (low stock threshold is default null, let's update it to 5)
    await fetch(`${BASE}/items/${prodA._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ lowStockThreshold: 5 })
    });
    await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ newStock: 2 })
    });

    // Item B (Service, shouldn't be counted in stock)
    const iB = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Svc A', type: 'Service', unitPrice: 50000, hsnSac: '1234', sku: 'SKU2' }) // 500 INR
    });
    const iBData = await iB.json();
    if (!iB.ok) throw new Error(JSON.stringify(iBData));
    svcB = iBData.data.item;

    // Draft invoice A (Should be excluded from sales)
    await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: new Date().toISOString(), items: [{ itemId: prodA._id, quantity: 1 }] })
    });

    // Finalized Invoice A
    const invRes1 = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: new Date().toISOString(), items: [{ itemId: svcB._id, quantity: 2 }] })
    });
    let invA = (await invRes1.json()).data.invoice;
    await fetch(`${BASE}/invoices/${invA._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` }});

    // Partial payment for A
    await fetch(`${BASE}/invoices/${invA._id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}`, 'X-Idempotency-Key': 'pay1' },
      body: JSON.stringify({ amount: 20000, paymentDate: new Date().toISOString(), method: 'Cash' })
    });

    // Tax Config B
    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ hsnSac: '0000', classificationType: 'HSN', gstRate: 0, taxTreatment: 'EXEMPT' })
    });

    // Finalized Invoice B (Business B)
    const iBReq = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ name: 'Prod B', type: 'Product', unitPrice: 200000, hsnSac: '0000', sku: 'SKU3' })
    });
    let prodB = (await iBReq.json()).data.item;

    const invResB = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ customerId: custB._id, date: new Date().toISOString(), items: [{ itemId: prodB._id, quantity: 1 }] })
    });
    let invB = (await invResB.json()).data.invoice;
    // We can't easily finalize if it's product without stock, so add stock
    await fetch(`${BASE}/inventory/${prodB._id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ newStock: 100 })
    });
    await fetch(`${BASE}/invoices/${invB._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userB.token}` }});
  });

  after(async () => {
    await mongoose.connection.close();
    await new Promise(resolve => server.close(resolve));
  });

  test('1. Unauthenticated dashboard request rejected', async () => {
    const res = await fetch(`${BASE}/dashboard/summary`);
    assert.strictEqual(res.status, 401);
  });

  test('2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16. Business A dashboard summary is correct', async () => {
    const res = await fetch(`${BASE}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Check KPIs
    const kpis = data.data.kpis;

    // 1 finalized invoice for A (Svc A qty 2 = 100k + 18% tax = 118k grand total)
    assert.strictEqual(kpis.invoiceCount, 1, 'Draft excluded, only finalized counted');
    assert.strictEqual(kpis.salesTotal, '118000.00', 'Sales total from finalized invoice only');
    assert.strictEqual(kpis.taxTotal, '18000.00', 'Tax total from finalized invoice');
    assert.strictEqual(kpis.paidTotal, '20000.00', 'Paid amount from payments');
    assert.strictEqual(kpis.outstandingAmount, '98000.00', 'Outstanding is grandTotal - paidAmount');

    // Inventory
    assert.strictEqual(kpis.lowStockCount, 1, 'Prod A is low stock');
    assert.strictEqual(kpis.outOfStockCount, 0, 'No out of stock');

    // Recent invoices
    const recent = data.data.recentInvoices;
    assert.strictEqual(recent.length, 2, 'Should return both draft and finalized in recent');
    assert.strictEqual(recent[0].customerSnapshot.name, 'Cust A');
  });

  test('Business B isolation', async () => {
    const res = await fetch(`${BASE}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    const data = await res.json();
    const kpis = data.data.kpis;

    assert.strictEqual(kpis.invoiceCount, 1);
    assert.strictEqual(kpis.salesTotal, '200000.00'); // 200k + 0 tax
    assert.strictEqual(kpis.paidTotal, '0.00');
  });
});
