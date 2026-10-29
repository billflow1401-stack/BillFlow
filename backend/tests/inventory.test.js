const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5010;
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

test('Phase 14 — Inventory (Integration)', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    const userA = await setupUser('inv14_a');
    const userB = await setupUser('inv14_b');

    // Setup: business profile with state
    await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ state: 'Maharashtra', invoiceSettings: { prefix: 'INV14-' } })
    });

    // Create tax config
    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '8471', classificationType: 'HSN', gstRate: 18, taxTreatment: 'TAXABLE' })
    });
    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '9983', classificationType: 'SAC', gstRate: 18, taxTreatment: 'TAXABLE' })
    });

    // Create customer
    const custRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Test Cust', state: 'Maharashtra', billingAddress: '123 Warehouse Rd, Pune' })
    });
    const custId = (await custRes.json()).data.customer._id;

    // Create Product A (stock 20)
    const prodARes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ type: 'Product', name: 'Widget A', unitPrice: 100000, taxType: 'Exclusive', hsnSac: '8471', currentStock: 20, lowStockThreshold: 5, unit: 'pcs', sku: `SKU-A-${uid}` })
    });
    const prodA = (await prodARes.json()).data.item;

    // Create Product B (stock 3)
    const prodBRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ type: 'Product', name: 'Widget B', unitPrice: 50000, taxType: 'Exclusive', hsnSac: '8471', currentStock: 3, lowStockThreshold: 2, unit: 'pcs', sku: `SKU-B-${uid}` })
    });
    const prodB = (await prodBRes.json()).data.item;

    // Create Service
    const svcRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ type: 'Service', name: 'Consulting', unitPrice: 200000, taxType: 'Exclusive', hsnSac: '9983' })
    });
    const svc = (await svcRes.json()).data.item;

    // ==================== BASIC INVENTORY ====================

    await t.test('1. Unauthenticated inventory access rejected', async () => {
      const res = await fetch(`${BASE}/inventory`);
      assert.strictEqual(res.status, 401);
    });

    await t.test('2. Authenticated user can view Product inventory', async () => {
      const res = await fetch(`${BASE}/inventory`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.inventory.length >= 2);
      const widgetA = data.data.inventory.find(i => i._id === prodA._id);
      assert.ok(widgetA);
      assert.strictEqual(widgetA.currentStock, 20);
      assert.strictEqual(widgetA.stockStatus, 'IN_STOCK');
    });

    await t.test('3. Business isolation — cannot see other business inventory', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}`, {
        headers: { Authorization: `Bearer ${userB.token}` }
      });
      assert.strictEqual(res.status, 404);
    });

    await t.test('4. Service cannot be treated as inventory target', async () => {
      const res = await fetch(`${BASE}/inventory/${svc._id}`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert.strictEqual(res.status, 404);
    });

    await t.test('5. Product stock displayed correctly', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.item.currentStock, 20);
      assert.strictEqual(data.data.item.lowStockThreshold, 5);
    });

    // ==================== STOCK IN ====================

    await t.test('6-9. Valid stock-in increases stock with correct movement', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/stock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ quantity: 5, note: 'Purchase order' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.result.balanceBefore, 20);
      assert.strictEqual(data.data.result.balanceAfter, 25);
      assert.strictEqual(data.data.result.quantity, 5);

      // Verify movement
      const mvRes = await fetch(`${BASE}/inventory/${prodA._id}/movements`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      const mvData = await mvRes.json();
      const inMv = mvData.data.movements.find(m => m.movementType === 'IN');
      assert.ok(inMv);
      assert.strictEqual(inMv.balanceBefore, 20);
      assert.strictEqual(inMv.balanceAfter, 25);
    });

    await t.test('10. Invalid stock-in rejected (zero/negative)', async () => {
      const r1 = await fetch(`${BASE}/inventory/${prodA._id}/stock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ quantity: 0 })
      });
      assert.strictEqual(r1.status, 400);
      const r2 = await fetch(`${BASE}/inventory/${prodA._id}/stock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ quantity: -5 })
      });
      assert.strictEqual(r2.status, 400);
    });

    // ==================== STOCK ADJUSTMENT ====================

    await t.test('17. Positive adjustment works', async () => {
      // Current stock is 25. Adjust to 30.
      const res = await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: 30, note: 'Physical count up' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.result.balanceBefore, 25);
      assert.strictEqual(data.data.result.balanceAfter, 30);
    });

    await t.test('18. Negative adjustment works', async () => {
      // Current stock is 30. Adjust to 28.
      const res = await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: 28, note: 'Shrinkage' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.result.balanceBefore, 30);
      assert.strictEqual(data.data.result.balanceAfter, 28);
    });

    await t.test('19. Adjustment cannot create negative stock', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: -1 })
      });
      assert.strictEqual(res.status, 400);
    });

    // ==================== QUANTITY PRECISION ====================

    await t.test('Fractional quantity (2 decimal places) accepted', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/stock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ quantity: 1.25 })
      });
      assert.strictEqual(res.status, 200);
      // Stock was 28, now 29.25
    });

    await t.test('Excessive precision (3+ decimal places) rejected', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/stock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ quantity: 1.234 })
      });
      assert.strictEqual(res.status, 400);
    });

    // Reset stock to a clean number for invoice tests
    await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ newStock: 10 })
    });

    // ==================== INVOICE INTEGRATION ====================

    // Helper: create and optionally finalize invoice
    const createInvoice = async (items) => {
      const res = await fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ date: new Date().toISOString(), customerId: custId, items })
      });
      const json = await res.json();
      if (!json.data) console.log(json);
      return json.data.invoice;
    };

    const finalizeInvoice = async (id) => {
      const res = await fetch(`${BASE}/invoices/${id}/finalize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      return { status: res.status, data: await res.json() };
    };

    await t.test('21. Draft invoice does not modify stock', async () => {
      const before = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      await createInvoice([{ itemId: prodA._id, quantity: 2, discount: 0 }]);
      const after = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.strictEqual(before.data.item.currentStock, after.data.item.currentStock);
    });

    await t.test('22. Finalized Product invoice deducts stock', async () => {
      const inv = await createInvoice([{ itemId: prodA._id, quantity: 3, discount: 0 }]);
      await finalizeInvoice(inv._id);
      const after = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.strictEqual(after.data.item.currentStock, 7); // 10 - 3
    });

    await t.test('23. Finalized Service invoice does not modify stock', async () => {
      const inv = await createInvoice([{ itemId: svc._id, quantity: 5, discount: 0 }]);
      await finalizeInvoice(inv._id);
      // Service has no stock — this should not throw
    });

    await t.test('24. Mixed Product+Service invoice deducts only Products', async () => {
      // prodA stock is now 7
      const inv = await createInvoice([
        { itemId: prodA._id, quantity: 2, discount: 0 },
        { itemId: svc._id, quantity: 3, discount: 0 }
      ]);
      await finalizeInvoice(inv._id);
      const after = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.strictEqual(after.data.item.currentStock, 5); // 7 - 2
    });

    await t.test('25. Repeated finalization does not deduct stock twice', async () => {
      const inv = await createInvoice([{ itemId: prodA._id, quantity: 1, discount: 0 }]);
      await finalizeInvoice(inv._id);
      // Stock is now 4
      const mid = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.strictEqual(mid.data.item.currentStock, 4);

      // Finalize AGAIN — should be idempotent
      await finalizeInvoice(inv._id);
      const after = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.strictEqual(after.data.item.currentStock, 4); // Unchanged
    });

    // ==================== SAME PRODUCT ON MULTIPLE LINES ====================

    await t.test('26. Same product on multiple invoice lines works', async () => {
      // Reset prodA to 10
      await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: 10 })
      });
      const inv = await createInvoice([
        { itemId: prodA._id, quantity: 2, discount: 0 },
        { itemId: prodA._id, quantity: 3, discount: 0 }
      ]);
      await finalizeInvoice(inv._id);
      const after = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.strictEqual(after.data.item.currentStock, 5); // 10 - 2 - 3
    });

    // ==================== CONCURRENCY ====================

    await t.test('27-29. Concurrent stock-out cannot oversell', async () => {
      // Reset prodA to 10
      await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: 10 })
      });
      // Create 3 invoices each needing 7 units of prodA
      const inv1 = await createInvoice([{ itemId: prodA._id, quantity: 7, discount: 0 }]);
      const inv2 = await createInvoice([{ itemId: prodA._id, quantity: 7, discount: 0 }]);
      const inv3 = await createInvoice([{ itemId: prodA._id, quantity: 7, discount: 0 }]);

      const results = await Promise.all([
        finalizeInvoice(inv1._id),
        finalizeInvoice(inv2._id),
        finalizeInvoice(inv3._id)
      ]);

      let successes = 0;
      results.forEach(r => { if (r.status === 200) successes++; });
      assert.ok(successes >= 1, 'At least one should succeed');
      assert.ok(successes <= 1, 'At most one can succeed (stock 10, need 7)');

      // Verify stock is non-negative
      const after = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.ok(after.data.item.currentStock >= 0, `Stock must be non-negative, got ${after.data.item.currentStock}`);
      assert.strictEqual(after.data.item.currentStock, 3); // 10 - 7
    });

    // ==================== MULTI-PRODUCT ATOMICITY ====================

    await t.test('30. Multi-product invoice fails atomically on insufficient stock', async () => {
      // prodA has 3 stock, prodB has 3 stock
      // Invoice: prodA=2, prodB=5 → prodB insufficient → everything rolls back
      const inv = await createInvoice([
        { itemId: prodA._id, quantity: 2, discount: 0 },
        { itemId: prodB._id, quantity: 5, discount: 0 }
      ]);
      const result = await finalizeInvoice(inv._id);
      assert.notStrictEqual(result.status, 200);

      // Both stocks should be unchanged
      const aStock = await (await fetch(`${BASE}/inventory/${prodA._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      const bStock = await (await fetch(`${BASE}/inventory/${prodB._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();
      assert.strictEqual(aStock.data.item.currentStock, 3);
      assert.strictEqual(bStock.data.item.currentStock, 3);
    });

    // ==================== LOW STOCK ====================

    await t.test('Low stock indicator works', async () => {
      // prodB has stock 3, threshold 2 → IN_STOCK
      const res = await fetch(`${BASE}/inventory/${prodB._id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
      const data = await res.json();
      assert.strictEqual(data.data.item.stockStatus, 'IN_STOCK');

      // Adjust to threshold level
      await fetch(`${BASE}/inventory/${prodB._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: 2 })
      });
      const res2 = await fetch(`${BASE}/inventory/${prodB._id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
      const data2 = await res2.json();
      assert.strictEqual(data2.data.item.stockStatus, 'LOW_STOCK');

      // Adjust to 0
      await fetch(`${BASE}/inventory/${prodB._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: 0 })
      });
      const res3 = await fetch(`${BASE}/inventory/${prodB._id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
      const data3 = await res3.json();
      assert.strictEqual(data3.data.item.stockStatus, 'OUT_OF_STOCK');
    });

    // ==================== MOVEMENT HISTORY ====================

    await t.test('31. Movement history is deterministic', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/movements`, {
        headers: { Authorization: `Bearer ${userA.token}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.movements.length > 0);
      // Verify ordering: newest first
      for (let i = 0; i < data.data.movements.length - 1; i++) {
        assert.ok(new Date(data.data.movements[i].createdAt) >= new Date(data.data.movements[i + 1].createdAt));
      }
    });

    // ==================== BUSINESS ISOLATION ====================

    await t.test('33. Business A cannot stock-in Business B product', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/stock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
        body: JSON.stringify({ quantity: 10 })
      });
      assert.strictEqual(res.status, 404);
    });

    await t.test('34. Business A cannot adjust Business B product', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
        body: JSON.stringify({ newStock: 999 })
      });
      assert.strictEqual(res.status, 404);
    });

    await t.test('35. Business A cannot read Business B movement history', async () => {
      const res = await fetch(`${BASE}/inventory/${prodA._id}/movements`, {
        headers: { Authorization: `Bearer ${userB.token}` }
      });
      assert.strictEqual(res.status, 404);
    });

    // ==================== FINANCIAL IMMUTABILITY ====================

    await t.test('36-39. Inventory does not modify invoice financials', async () => {
      // Reset prodA
      await fetch(`${BASE}/inventory/${prodA._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({ newStock: 50 })
      });
      const inv = await createInvoice([{ itemId: prodA._id, quantity: 1, discount: 0 }]);
      const beforeFin = await (await fetch(`${BASE}/invoices/${inv._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();

      await finalizeInvoice(inv._id);

      const afterFin = await (await fetch(`${BASE}/invoices/${inv._id}`, { headers: { Authorization: `Bearer ${userA.token}` } })).json();

      // Financial fields must be identical
      assert.strictEqual(beforeFin.data.invoice.summary.grandTotal, afterFin.data.invoice.summary.grandTotal);
      assert.strictEqual(beforeFin.data.invoice.summary.taxTotal, afterFin.data.invoice.summary.taxTotal);
      assert.strictEqual(beforeFin.data.invoice.summary.subTotal, afterFin.data.invoice.summary.subTotal);
      assert.strictEqual(beforeFin.data.invoice.summary.taxableTotal, afterFin.data.invoice.summary.taxableTotal);
      assert.strictEqual(beforeFin.data.invoice.summary.cgstTotal, afterFin.data.invoice.summary.cgstTotal);
      assert.strictEqual(beforeFin.data.invoice.summary.sgstTotal, afterFin.data.invoice.summary.sgstTotal);
      assert.deepStrictEqual(beforeFin.data.invoice.customerSnapshot, afterFin.data.invoice.customerSnapshot);
      assert.deepStrictEqual(beforeFin.data.invoice.items, afterFin.data.invoice.items);
    });

  } finally {
    server.close();
    await mongoose.connection.close();
  }
});
