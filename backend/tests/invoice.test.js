const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5007;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

// ---------------------------------------------------------
// Helper: create test business and user
// ---------------------------------------------------------
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

test('Phase 9 — Invoice Engine (Integration & Unit)', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    const userA = await setupUser('inv_a');
    const userB = await setupUser('inv_b');

    // Setup initial data for User A
    // 1. Business Profile (State required for supply type)
    await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ state: 'Maharashtra', invoiceSettings: { prefix: 'INVA-' } })
    });

    // 2. Customers
    const createCustRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Cust Intra', state: 'Maharashtra', email: 'intra@test.com', billingAddress: '123 MG Road, Mumbai' })
    });
    const custIntraId = (await createCustRes.json()).data.customer._id;

    const createCustInterRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Cust Inter', state: 'Karnataka', email: 'inter@test.com', billingAddress: '456 Brigade Rd, Bangalore' })
    });
    const custInterId = (await createCustInterRes.json()).data.customer._id;

    // 3. Tax Configs
    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '1818', classificationType: 'HSN', gstRate: 18, taxTreatment: 'TAXABLE' })
    });
    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '0505', classificationType: 'HSN', gstRate: 5, taxTreatment: 'TAXABLE' })
    });
    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '0000', classificationType: 'SAC', gstRate: 0, taxTreatment: 'EXEMPT' })
    });

    // 4. Items
    const createItem18Res = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Item 18% Excl', type: 'Product', unitPrice: 100000, taxType: 'Exclusive', hsnSac: '1818', sku: 'SKU18EX', currentStock: 100 })
    });
    const d18 = await createItem18Res.json();
    if(!createItem18Res.ok) throw new Error(JSON.stringify(d18));
    const item18Id = d18.data.item._id;

    const createItem18InclRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Item 18% Incl', type: 'Service', unitPrice: 118000, taxType: 'Inclusive', hsnSac: '1818', sku: 'SKU18IN' })
    });
    const d18Incl = await createItem18InclRes.json();
    if(!createItem18InclRes.ok) throw new Error(JSON.stringify(d18Incl));
    const item18InclId = d18Incl.data.item._id;

    const createItem5Res = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Item 5%', type: 'Product', unitPrice: 100000, taxType: 'Exclusive', hsnSac: '0505', sku: 'SKU5', currentStock: 100 })
    });
    const d5 = await createItem5Res.json();
    if(!createItem5Res.ok) throw new Error(JSON.stringify(d5));
    const item5Id = d5.data.item._id;

    const createItemExemptRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Item Exempt', type: 'Service', unitPrice: 50000, taxType: 'Exclusive', hsnSac: '0000', sku: 'SKUEX' })
    });
    const dEx = await createItemExemptRes.json();
    if(!createItemExemptRes.ok) throw new Error(JSON.stringify(dEx));
    const itemExemptId = dEx.data.item._id;

    // --- TESTS ---

    // 1. Unauthenticated invoice creation rejected
    const unauthRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: custIntraId, date: new Date().toISOString(), items: [{ itemId: item18Id, quantity: 1 }] })
    });
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated invoice creation should be rejected');

    // 2. Authenticated user can create a draft invoice
    // 4. Valid customer can be attached. 5. Valid Product can be attached.
    const draftRes1 = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [{ itemId: item18Id, quantity: 1 }]
      })
    });
    if(!draftRes1.ok) console.log('Invoice Creation Error:', await draftRes1.json());
    assert.strictEqual(draftRes1.status, 201, 'Should create draft invoice');
    const draft1 = (await draftRes1.json()).data.invoice;
    assert.strictEqual(draft1.status, 'Draft', 'New invoice must be draft');

    // 3. BusinessId is server-derived
    assert.strictEqual(draft1.businessId, userA.businessId, 'BusinessId should be strictly enforced from token');

    // 6. Valid Service can be attached (tested in item18InclId creation)
    // 8. Fractional quantity behavior
    const fracRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [{ itemId: item18InclId, quantity: 1.5 }]
      })
    });
    assert.strictEqual(fracRes.status, 201, 'Fractional quantity allowed');

    // 9. Line discount works & 10. Discount > gross rejected
    const invalidDiscRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [{ itemId: item18Id, quantity: 1, discount: 200000 }] // Price is 100000, discount 200000
      })
    });
    assert.strictEqual(invalidDiscRes.status, 400, 'Discount > gross should be rejected');

    // 11. Exclusive pricing & 18. Intra-state & 21. Integer totals & 22. Deterministic rounding
    // CASE 1 — EXCLUSIVE INTRA-STATE
    const case1Res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [{ itemId: item18Id, quantity: 1 }] // Price 100000, 18% Excl
      })
    });
    const case1 = (await case1Res.json()).data.invoice;
    assert.strictEqual(case1.summary.taxableTotal, '100000.00');
    assert.strictEqual(case1.summary.cgstTotal, '9000.00');
    assert.strictEqual(case1.summary.sgstTotal, '9000.00');
    assert.strictEqual(case1.summary.igstTotal, '0.00');
    assert.strictEqual(case1.summary.taxTotal, '18000.00');
    assert.strictEqual(case1.summary.grandTotal, '118000.00');

    // 12. Inclusive pricing (CASE 2)
    const case2Res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [{ itemId: item18InclId, quantity: 1 }] // Price 118000, 18% Incl
      })
    });
    const case2 = (await case2Res.json()).data.invoice;
    assert.strictEqual(case2.summary.taxableTotal, '100000.00');
    assert.strictEqual(case2.summary.cgstTotal, '9000.00');
    assert.strictEqual(case2.summary.sgstTotal, '9000.00');
    assert.strictEqual(case2.summary.taxTotal, '18000.00');
    assert.strictEqual(case2.summary.grandTotal, '118000.00');

    // 19. Inter-state IGST (CASE 3)
    const case3Res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custInterId,
        date: new Date().toISOString(),
        items: [{ itemId: item18Id, quantity: 1 }] // Price 100000, 18% Excl, Inter-state
      })
    });
    const case3 = (await case3Res.json()).data.invoice;
    assert.strictEqual(case3.summary.cgstTotal, '0.00');
    assert.strictEqual(case3.summary.sgstTotal, '0.00');
    assert.strictEqual(case3.summary.igstTotal, '18000.00');
    assert.strictEqual(case3.summary.grandTotal, '118000.00');

    // Discount Calculation (CASE 4)
    const case4Res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [{ itemId: item5Id, quantity: 2, discount: 10000, unitPriceOverride: 50000 }] // Qty 2, Price 50k, Disc 10k => Taxable 90k, 5% Excl
      })
    });
    const case4 = (await case4Res.json()).data.invoice;
    assert.strictEqual(case4.items[0].unitPrice, '50000.00', 'Price override should be respected');
    assert.strictEqual(case4.summary.subTotal, '100000.00');
    assert.strictEqual(case4.summary.discountTotal, '10000.00');
    assert.strictEqual(case4.summary.taxableTotal, '90000.00');
    assert.strictEqual(case4.summary.cgstTotal, '2250.00'); // 2.5% of 90k
    assert.strictEqual(case4.summary.sgstTotal, '2250.00');
    assert.strictEqual(case4.summary.taxTotal, '4500.00');
    assert.strictEqual(case4.summary.grandTotal, '94500.00');

    // 17. Multiple GST rates within same invoice
    const multiRateRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [
          { itemId: item18Id, quantity: 1 }, // Taxable: 100k, GST: 18k
          { itemId: item5Id, quantity: 1 },  // Taxable: 100k, GST: 5k
          { itemId: itemExemptId, quantity: 1 } // Taxable: 50k, GST: 0k
        ]
      })
    });
    const multiRate = (await multiRateRes.json()).data.invoice;
    assert.strictEqual(multiRate.summary.taxableTotal, '250000.00');
    assert.strictEqual(multiRate.summary.taxTotal, '23000.00');
    assert.strictEqual(multiRate.summary.grandTotal, '273000.00');

    // 24, 25, 26, 27, 28, 29: Snapshots and Historical Stability
    // Modify customer, item, and tax config after finalizing an invoice
    const draftForFinalizeRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        customerId: custIntraId,
        date: new Date().toISOString(),
        items: [{ itemId: item18Id, quantity: 1 }]
      })
    });
    const draftId = (await draftForFinalizeRes.json()).data.invoice._id;

    // 30, 31, 32: Finalization generates business-specific invoice number via atomic counter
    const final1Res = await fetch(`${BASE}/invoices/${draftId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    const final1 = (await final1Res.json()).data.invoice;
    assert.strictEqual(final1.status, 'Unpaid', 'Status should be finalized (Unpaid)');
    assert.strictEqual(final1.invoiceNumber, 'INVA-0001');

    // Attempt modifying the original references
    await fetch(`${BASE}/customers/${custIntraId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Cust Intra MODIFIED' })
    });
    await fetch(`${BASE}/items/${item18Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Item 18 MODIFIED', unitPrice: 999999 })
    });

    // Retrieve finalized invoice
    const getFinal1Res = await fetch(`${BASE}/invoices/${draftId}`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    const retrievedFinal1 = (await getFinal1Res.json()).data.invoice;
    assert.strictEqual(retrievedFinal1.customerSnapshot.name, 'Cust Intra', 'Customer snapshot should remain unchanged');
    assert.strictEqual(retrievedFinal1.items[0].name, 'Item 18% Excl', 'Item snapshot should remain unchanged');
    assert.strictEqual(retrievedFinal1.items[0].unitPrice, '100000.00', 'Price snapshot should remain unchanged');
    assert.strictEqual(retrievedFinal1.summary.grandTotal, '118000.00', 'Grand total should remain unchanged');

    // 35. Repeated finalization of an already finalized invoice does not create another number
    const finalRepeatRes = await fetch(`${BASE}/invoices/${draftId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.strictEqual(finalRepeatRes.status, 200);
    const finalRepeat = (await finalRepeatRes.json()).data.invoice;
    assert.strictEqual(finalRepeat.invoiceNumber, 'INVA-0001', 'Should not increment counter again');

    // 37, 38, 39, 40, 41: ISOLATION (Business A cannot use Business B resources)
    const bDraftRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({
        customerId: custIntraId, // User A's customer
        date: new Date().toISOString(),
        items: [{ itemId: item18Id, quantity: 1 }] // User A's item
      })
    });
    assert.strictEqual(bDraftRes.status, 404, 'User B using User A resources should fail');

    const getABRes = await fetch(`${BASE}/invoices/${draftId}`, {
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert.strictEqual(getABRes.status, 404, 'User B cannot read User A invoice');

    // Concurrency test for Counter
    const pDrafts = await Promise.all([1, 2, 3].map(async () => {
      const res = await fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({
          customerId: custIntraId,
          date: new Date().toISOString(),
          items: [{ itemId: itemExemptId, quantity: 1 }]
        })
      });
      return (await res.json()).data.invoice._id;
    }));

    const pFinals = await Promise.all(pDrafts.map(id => fetch(`${BASE}/invoices/${id}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    }).then(res => res.json())));

    const invNumbers = pFinals.map(r => r.data.invoice.invoiceNumber).sort();
    assert.deepStrictEqual(invNumbers, ['INVA-0002', 'INVA-0003', 'INVA-0004'], 'Concurrent finalization generates safe unique sequential numbers');

    // Cleanup
    const Invoice = require('../src/models/Invoice');
    const Counter = require('../src/models/Counter');
    const User = require('../src/models/User');
    const Business = require('../src/models/Business');
    const Customer = require('../src/models/Customer');
    const Item = require('../src/models/Item');
    const TaxConfig = require('../src/models/TaxConfig');

    await Invoice.deleteMany({ businessId: { $in: [userA.businessId, userB.businessId] } });
    await Counter.deleteMany({ businessId: { $in: [userA.businessId, userB.businessId] } });
    await User.deleteMany({ email: { $in: [`inv_a_${uid}@test.com`, `inv_b_${uid}@test.com`] } });
    await Business.deleteMany({ _id: { $in: [userA.businessId, userB.businessId] } });
    await Customer.deleteMany({ businessId: { $in: [userA.businessId, userB.businessId] } });
    await Item.deleteMany({ businessId: { $in: [userA.businessId, userB.businessId] } });
    await TaxConfig.deleteMany({ businessId: { $in: [userA.businessId, userB.businessId] } });

  } finally {
    server.close();
    await mongoose.disconnect();
  }
});
