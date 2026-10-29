const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5009; // Use unique port for this suite
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

const setupUser = async (prefix) => {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: `${prefix} Business ${uid}`,
      name: `${prefix} User ${uid}`,
      email: `${prefix.toLowerCase()}_user${uid}@example.com`,
      password: 'password123'
    })
  });
  const data = await res.json();
  return { token: data.data.token, user: data.data.user };
};

const setupData = async (token) => {
  // Update business profile state
  await fetch(`${BASE}/business/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ state: 'Maharashtra', invoiceSettings: { prefix: 'INV-' } })
  });

  // Create Tax Config
  await fetch(`${BASE}/tax-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ hsnSac: '9983', classificationType: 'SAC', gstRate: 18, taxTreatment: 'TAXABLE' })
  });

  // Create customer
  const custRes = await fetch(`${BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Test Customer',
      customerType: 'Business',
      state: 'Maharashtra',
      billingAddress: '123 MG Road, Mumbai'
    })
  });
  const custData = await custRes.json();

  // Create item
  const itemRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      type: 'Service',
      name: 'Test Service',
      unitPrice: 100000,
      taxType: 'Exclusive',
      hsnSac: '9983'
    })
  });
  const itemData = await itemRes.json();
  if (!itemRes.ok) throw new Error(`Item creation failed: ${JSON.stringify(itemData)}`);

  return { customerId: custData.data.customer._id, itemId: itemData.data.item._id };
};

const createInvoice = async (token, customerId, itemId, quantity = 1) => {
  const draftRes = await fetch(`${BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      date: new Date().toISOString(),
      customerId,
      items: [{
        itemId,
        quantity,
        discount: 0
      }]
    })
  });
  const draftData = await draftRes.json();
  const invoiceId = draftData.data.invoice._id;

  await fetch(`${BASE}/invoices/${invoiceId}/finalize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  return invoiceId;
};

test('Phase 13 — Payment Tracking (Transactions & Concurrency)', async (t) => {
  let server;
  let token1, token2;
  let cust1, item1;
  let invoice1, draftInvoice1;

  t.before(async () => {
    await mongoose.connect(env.mongoUri);
    // Setup indexes to ensure idempotency uniqueness acts correctly
    await mongoose.connection.collection('payments').createIndex({ businessId: 1, idempotencyKey: 1 }, { unique: true });

    await new Promise(resolve => {
      server = app.listen(TEST_PORT, resolve);
    });

    const u1 = await setupUser('Main');
    token1 = u1.token;

    const u2 = await setupUser('Other');
    token2 = u2.token;

    const data1 = await setupData(token1);
    cust1 = data1.customerId;
    item1 = data1.itemId;

    // Create a draft invoice
    const draftRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
      body: JSON.stringify({
        date: new Date().toISOString(),
        customerId: cust1,
        items: [{
          itemId: item1,
          quantity: 1,
          discount: 0
        }]
      })
    });
    draftInvoice1 = (await draftRes.json()).data.invoice._id;

    // Create a finalized invoice with total = 236000 (qty 2 * 100000 + 18%)
    invoice1 = await createInvoice(token1, cust1, item1, 2);
  });

  t.after(async () => {
    server.close();
    await mongoose.connection.close();
  });

  await t.test('Reject payment without idempotency key', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
      body: JSON.stringify({
        amount: 50000,
        paymentDate: new Date().toISOString(),
        method: 'Bank Transfer'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('Reject payment for draft invoice', async () => {
    const res = await fetch(`${BASE}/invoices/${draftInvoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': 'draft-test' },
      body: JSON.stringify({
        amount: 50000,
        paymentDate: new Date().toISOString(),
        method: 'Bank Transfer'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  const paymentDate1 = new Date().toISOString();

  await t.test('Phase 20 - API Boundary Validation - Reject excess precision amount', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `float-${uid}` },
      body: JSON.stringify({
        amount: 50000.555, // Excess decimal places (>2)
        paymentDate: new Date().toISOString(),
        method: 'Bank Transfer'
      })
    });
    // Zod validation should reject it as 400
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  await t.test('Valid Partial Payment', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `p1-${uid}` },
      body: JSON.stringify({
        amount: 100000,
        paymentDate: paymentDate1,
        method: 'Bank Transfer'
      })
    });
    if (res.status === 500) {
      throw new Error(`500 ERROR: ${await res.text()}`);
    }
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.data.invoice.status, 'Partially Paid');
    assert.strictEqual(data.data.invoice.paymentStatus.paidAmount, '100000.00');
    assert.strictEqual(data.data.invoice.paymentStatus.balanceDue, '136000.00'); // 236000 - 100000
    // Immutability
    assert.strictEqual(data.data.invoice.summary.grandTotal, '236000.00');
  });

  await t.test('Idempotency Case A (same payload) returns 200 OK', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `p1-${uid}` },
      body: JSON.stringify({
        amount: 100000,
        paymentDate: paymentDate1,
        method: 'Bank Transfer'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.data.payment.amount, '100000.00');
  });

  await t.test('Idempotency Case B (different payload) returns 409 Conflict', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `p1-${uid}` },
      body: JSON.stringify({
        amount: 50000, // Different amount
        paymentDate: paymentDate1,
        method: 'Bank Transfer'
      })
    });
    assert.strictEqual(res.status, 409);
  });

  await t.test('Overpayment rejected', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `over-${uid}` },
      body: JSON.stringify({
        amount: 200000, // Balance is 136000
        paymentDate: new Date().toISOString(),
        method: 'Cash'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('Concurrent identical payments limit to remaining balance (Transactions work)', async () => {
    // Current balance 136000
    const keys = [`conc1-${uid}`, `conc2-${uid}`, `conc3-${uid}`];
    const promises = keys.map(k => fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': k },
      body: JSON.stringify({ amount: 100000, paymentDate: new Date().toISOString(), method: 'UPI' })
    }));

    const results = await Promise.all(promises);
    let successes = 0;
    let conflictsOrErrors = 0;

    results.forEach(r => {
      if (r.status === 201) successes++;
      else {
        conflictsOrErrors++;
        // Verify we got a controlled error (409 Conflict or 400 Bad Request) and not a 500
        assert.ok([400, 409].includes(r.status));
      }
    });

    assert.strictEqual(successes, 1);
    assert.strictEqual(conflictsOrErrors, 2);

    // Verify DB state
    const res = await fetch(`${BASE}/invoices/${invoice1}`, {
      headers: { 'Authorization': `Bearer ${token1}` }
    });
    const { invoice } = (await res.json()).data;
    assert.strictEqual(invoice.paymentStatus.paidAmount, '200000.00');
    assert.strictEqual(invoice.paymentStatus.balanceDue, '36000.00');
  });

  await t.test('Final Payment updates to Paid', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `final-${uid}` },
      body: JSON.stringify({
        amount: 36000,
        paymentDate: new Date().toISOString(),
        method: 'Cash'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.data.invoice.status, 'Paid');
    assert.strictEqual(data.data.invoice.paymentStatus.balanceDue, '0.00');
  });

  await t.test('Cannot pay a Paid invoice', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `extra-${uid}` },
      body: JSON.stringify({ amount: 100, paymentDate: new Date().toISOString(), method: 'Cash' })
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('Get Payment History', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      headers: { 'Authorization': `Bearer ${token1}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.results, 3);
  });

  await t.test('Full & Final Settlement with negotiated waiver closes invoice as Paid', async () => {
    // Create new finalized invoice (total = 118000)
    const settleInvoice = await createInvoice(token1, cust1, item1, 1);
    
    // Customer negotiates to pay 100000 instead of 118000 (18000 waived)
    const res = await fetch(`${BASE}/invoices/${settleInvoice}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `settle-${uid}` },
      body: JSON.stringify({
        amount: 100000,
        paymentDate: new Date().toISOString(),
        method: 'UPI',
        isFinalSettlement: true,
        settlementReason: 'Customer negotiated discount of 18000'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.data.invoice.status, 'Paid');
    assert.strictEqual(data.data.invoice.paymentStatus.paidAmount, '100000.00');
    assert.strictEqual(data.data.invoice.paymentStatus.balanceDue, '0.00');
    assert.strictEqual(data.data.invoice.paymentStatus.settlementDiscount, '18000.00');
    assert.strictEqual(data.data.invoice.paymentStatus.isSettled, true);
    assert.strictEqual(data.data.payment.isFinalSettlement, true);
  });

  await t.test('Zero-amount waiver closes remaining balance as Paid', async () => {
    // Create new finalized invoice (total = 118000)
    const waiveInvoice = await createInvoice(token1, cust1, item1, 1);

    // Pay 117999.60 via UPI, leaving 0.40
    await fetch(`${BASE}/invoices/${waiveInvoice}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `part-${uid}` },
      body: JSON.stringify({
        amount: 117999.60,
        paymentDate: new Date().toISOString(),
        method: 'UPI'
      })
    });

    // Now waive the remaining 0.40 paise with amount = 0 and isFinalSettlement = true
    const res = await fetch(`${BASE}/invoices/${waiveInvoice}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}`, 'X-Idempotency-Key': `waive-${uid}` },
      body: JSON.stringify({
        amount: 0,
        paymentDate: new Date().toISOString(),
        method: 'Settlement Discount',
        isFinalSettlement: true,
        settlementReason: '40 paise round-off adjustment'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.data.invoice.status, 'Paid');
    assert.strictEqual(data.data.invoice.paymentStatus.paidAmount, '117999.60');
    assert.strictEqual(data.data.invoice.paymentStatus.balanceDue, '0.00');
    assert.strictEqual(data.data.invoice.paymentStatus.settlementDiscount, '0.40');
    assert.strictEqual(data.data.invoice.paymentStatus.isSettled, true);
  });

  await t.test('Business Isolation', async () => {
    const res = await fetch(`${BASE}/invoices/${invoice1}/payments`, {
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    assert.strictEqual(res.status, 404); // Should not find invoice
  });
});
