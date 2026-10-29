const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');
const pdfParse = require('pdf-parse');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5008;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

const setupUser = async (prefix) => {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${prefix} User`, email: `${prefix}_${uid}@test.com`,
      password: 'password123', businessName: `${prefix} Business`
    })
  });
  const data = await res.json();
  return { token: data.data.token, businessId: data.data.business._id };
};

test('Phase 11 — PDF Generation', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    const userA = await setupUser('pdf_a');
    const userB = await setupUser('pdf_b');

    // Create Customer
    const custRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'PDF Customer', email: 'cust@test.com', gstin: '27AAAAA0000A1Z5' })
    });
    const customerId = (await custRes.json()).data.customer._id;

    // Create Tax Config
    const taxRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '9999', description: 'desc', classificationType: 'SAC', gstRate: 18 })
    });
    const taxData = await taxRes.json();
    if (!taxRes.ok) throw new Error('Tax Config failed: ' + JSON.stringify(taxData));
    const taxConfigId = taxData.data.taxConfig._id;

    // Create Item
    const itemRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'PDF Service', type: 'Service', unitPrice: 500, hsnSac: '9999' })
    });
    const itemData = await itemRes.json();
    if (!itemRes.ok) throw new Error('Item failed: ' + JSON.stringify(itemData));
    const itemId = itemData.data.item._id;

    // Create Invoice 1
    const invRes1 = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId, date: new Date().toISOString(), items: [{ itemId, quantity: 2 }] })
    });
    const invoiceId = (await invRes1.json()).data.invoice._id;

    // Create Multi-page Invoice
    const manyItems = Array.from({ length: 60 }).map(() => ({ itemId, quantity: 1 }));
    const invRes2 = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId, date: new Date().toISOString(), items: manyItems })
    });
    const multiPageInvoiceId = (await invRes2.json()).data.invoice._id;

    // Finalize them
    await fetch(`${BASE}/invoices/${invoiceId}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    await fetch(`${BASE}/invoices/${multiPageInvoiceId}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await t.test('Reject unauthenticated PDF request', async () => {
      const res = await fetch(`${BASE}/invoices/${invoiceId}/pdf`);
      assert.strictEqual(res.status, 401);
    });

    await t.test('Enforce business isolation', async () => {
      const res = await fetch(`${BASE}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${userB.token}` }
      });
      assert.strictEqual(res.status, 404);
    });

    await t.test('Generate valid PDF with correct headers', async () => {
      const res = await fetch(`${BASE}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      if (!res.ok) {
        console.error('PDF generation failed:', await res.text());
      }
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
      assert.ok(res.headers.get('content-disposition').includes('attachment; filename="Invoice-'));

      const arrayBuffer = await res.arrayBuffer();
      const pdfBuffer = Buffer.alloc(arrayBuffer.byteLength);
      Buffer.from(arrayBuffer).copy(pdfBuffer);

      assert.ok(pdfBuffer.length > 100);
      assert.strictEqual(pdfBuffer.toString('utf8', 0, 5), '%PDF-');
    });


    await t.test('Deterministic multi-page PDF', async () => {
      const res = await fetch(`${BASE}/invoices/${multiPageInvoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      if (!res.ok) console.error('Error:', await res.text());
      const arrayBuffer = await res.arrayBuffer();
      const pdfBuffer = Buffer.alloc(arrayBuffer.byteLength);
      Buffer.from(arrayBuffer).copy(pdfBuffer);
      console.log('Multi-page PDF size:', pdfBuffer.byteLength);
      let pdfData;
      let attempts = 0;
      while (attempts < 3) {
        try {
          pdfData = await pdfParse(pdfBuffer);
          break;
        } catch (e) {
          attempts++;
          if (attempts === 3) {
            console.error('Failed to parse PDF after 3 attempts');
            throw e;
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }

      assert.ok(pdfData.numpages > 1, 'PDF should have more than 1 page');

      const text = pdfData.text;
      assert.ok(text.includes('pdf_a Business'));
      assert.ok(text.includes('PDF Customer'));
      assert.ok(text.includes('27AAAAA0000A1Z5'));
      assert.ok(text.includes('PDF Service'));
      assert.ok(text.includes('9999'));
      // Qty 1 * 500 = 500 base, +18% GST = 590.00 per item
      assert.ok(text.includes('500.00'));
      assert.ok(text.includes('590.00'));
      // Total 60 items * 590 = 35400.00
      assert.ok(text.includes('35,400.00'));
    });

  } finally {
    server.close();
    await mongoose.connection.close();
  }
});
