const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5013;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

let server;

describe('Phase 16 — Reports', () => {
  let userA, userB;
  let custA, custB;
  let prodA, prodB, svcA;

  before(async () => {
    await mongoose.connect(env.mongoUri);
    server = app.listen(TEST_PORT);

    // Users
    userA = (await (await fetch(`${BASE}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A', email: `a_${uid}@test.com`, password: 'password123', businessName: 'Biz A' })
    })).json()).data;

    userB = (await (await fetch(`${BASE}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B', email: `b_${uid}@test.com`, password: 'password123', businessName: 'Biz B' })
    })).json()).data;

    // Customers
    custA = (await (await fetch(`${BASE}/customers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Cust A', customerType: 'Individual', state: 'Maharashtra', billingAddress: '123 MG Road, Mumbai' })
    })).json()).data.customer;

    custB = (await (await fetch(`${BASE}/customers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ name: 'Cust B', customerType: 'Individual', state: 'Delhi', billingAddress: '456 Ring Road, Delhi' })
    })).json()).data.customer;

    // TaxConfigs for A
    await fetch(`${BASE}/tax-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '1234', classificationType: 'HSN', taxTreatment: 'TAXABLE', gstRate: 18 })
    });
    await fetch(`${BASE}/tax-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '9988', classificationType: 'SAC', taxTreatment: 'TAXABLE', gstRate: 18 })
    });
    await fetch(`${BASE}/tax-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ hsnSac: '7777', classificationType: 'HSN', taxTreatment: 'TAXABLE', gstRate: 5 })
    });

    // Items for A
    prodA = (await (await fetch(`${BASE}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Prod A', type: 'Product', unitPrice: 100000, hsnSac: '1234', sku: 'SKU-PA' })
    })).json()).data.item;

    svcA = (await (await fetch(`${BASE}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Svc A', type: 'Service', unitPrice: 50000, hsnSac: '9988', sku: 'SKU-SA' })
    })).json()).data.item;

    let prod5Percent = (await (await fetch(`${BASE}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Prod 5', type: 'Product', unitPrice: 100000, hsnSac: '7777', sku: 'SKU-P5' })
    })).json()).data.item;

    // Missing HSN/SAC item for A
    const missingHsn = (await (await fetch(`${BASE}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ name: 'Prod Miss', type: 'Product', unitPrice: 20000, sku: 'SKU-PM' })
    })).json()).data.item;

    // Add stock for A
    await fetch(`${BASE}/inventory/${prodA._id}/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ newStock: 100 }) });
    await fetch(`${BASE}/inventory/${prod5Percent._id}/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ newStock: 100 }) });
    await fetch(`${BASE}/inventory/${missingHsn._id}/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ newStock: 100 }) });

    // Item for B
    await fetch(`${BASE}/tax-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ hsnSac: '0000', classificationType: 'HSN', taxTreatment: 'EXEMPT', gstRate: 0 })
    });
    prodB = (await (await fetch(`${BASE}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ name: 'Prod B', type: 'Product', unitPrice: 200000, hsnSac: '0000', sku: 'SKU-PB' })
    })).json()).data.item;
    await fetch(`${BASE}/inventory/${prodB._id}/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` }, body: JSON.stringify({ newStock: 100 }) });

    // --- Create Invoices for A ---
    // 1. Draft (Should be excluded)
    await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: '2026-09-01T10:00:00.000Z', items: [{ itemId: prodA._id, quantity: 1 }] })
    });

    // 2. Finalized Invoice 1 (Start boundary test)
    let inv1Res = await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: '2026-08-31T18:30:00.000Z', items: [{ itemId: prodA._id, quantity: 2 }] }) // Exact start of 2026-09-01 IST
    });
    if(!inv1Res.ok) throw new Error(await inv1Res.text());
    let inv1 = (await inv1Res.json()).data.invoice;
    await fetch(`${BASE}/invoices/${inv1._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` }});

    // 3. Finalized Invoice 2 (End boundary late timestamp included)
    let inv2 = (await (await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: '2026-09-30T18:29:59.000Z', items: [{ itemId: svcA._id, quantity: 1 }] }) // 23:59:59 on 2026-09-30 IST
    })).json()).data.invoice;
    await fetch(`${BASE}/invoices/${inv2._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` }});

    // 3b. Finalized Invoice end midnight (End date midnight included)
    let invEndMidnight = (await (await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: '2026-09-29T18:30:00.000Z', items: [{ itemId: svcA._id, quantity: 1 }] }) // 00:00:00 on 2026-09-30 IST
    })).json()).data.invoice;
    await fetch(`${BASE}/invoices/${invEndMidnight._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` }});

    // 4. Finalized Invoice 3 (Next calendar day excluded)
    let inv3 = (await (await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: '2026-09-30T18:30:00.000Z', items: [{ itemId: prodA._id, quantity: 1 }] }) // 00:00:00 on 2026-10-01 IST
    })).json()).data.invoice;
    await fetch(`${BASE}/invoices/${inv3._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` }});

    // 5. Finalized Invoice 4 (5% rate item)
    let inv4 = (await (await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: '2026-09-15T12:00:00.000Z', items: [{ itemId: prod5Percent._id, quantity: 1 }] })
    })).json()).data.invoice;
    await fetch(`${BASE}/invoices/${inv4._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` }});
    let payRes = await fetch(`${BASE}/invoices/${inv4._id}/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}`, 'X-Idempotency-Key': 'payinv41234' },
      body: JSON.stringify({ amount: 50000, paymentDate: '2026-09-16T12:00:00.000Z', method: 'Cash' }) // partial pay
    });
    if (!payRes.ok) throw new Error('Payment failed: ' + await payRes.text());

    // 6. Finalized Invoice 5 (Missing HSN - 0% NON_GST)
    let inv5 = (await (await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ customerId: custA._id, date: '2026-09-15T12:00:00.000Z', items: [{ itemId: missingHsn._id, quantity: 5 }] }) // 100k
    })).json()).data.invoice;
    await fetch(`${BASE}/invoices/${inv5._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` }});

    // --- Create Invoice for B ---
    let invB = (await (await fetch(`${BASE}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ customerId: custB._id, date: '2026-09-15T12:00:00.000Z', items: [{ itemId: prodB._id, quantity: 1 }] })
    })).json()).data.invoice;
    await fetch(`${BASE}/invoices/${invB._id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${userB.token}` }});
  });

  after(async () => {
    await mongoose.connection.close();
    server.close();
  });

  // Scenarios 1
  test('1. Unauthenticated request -> 401', async () => {
    const res = await fetch(`${BASE}/reports/sales?startDate=2026-09-01&endDate=2026-09-30`);
    assert.strictEqual(res.status, 401);
  });

  // Scenarios 9, 10, 11, 13
  test('9, 10, 11, 13. Invalid date formats, impossible dates, reversed dates, beyond allowed range', async () => {
    const getCode = async (start, end) => (await fetch(`${BASE}/reports/sales?startDate=${start}&endDate=${end}`, { headers: { Authorization: `Bearer ${userA.token}` }})).status;

    assert.strictEqual(await getCode('2026-09-01', '2026-09-'), 400); // Invalid format
    assert.strictEqual(await getCode('2026-02-30', '2026-03-10'), 400); // Impossible date
    assert.strictEqual(await getCode('2026-09-30', '2026-09-01'), 400); // startDate after endDate
    assert.strictEqual(await getCode('2025-01-01', '2026-01-01'), 400); // Beyond 1 year - 1 day
  });

  // Scenario 12
  test('12. Exactly one allowed calendar year -> accepted, same-day range -> accepted', async () => {
    const getCode = async (start, end) => (await fetch(`${BASE}/reports/sales?startDate=${start}&endDate=${end}`, { headers: { Authorization: `Bearer ${userA.token}` }})).status;
    assert.strictEqual(await getCode('2026-01-01', '2026-12-31'), 200); // exactly 1 year - 1 day
    assert.strictEqual(await getCode('2026-09-15', '2026-09-15'), 200); // exactly same day
  });

  // Scenarios 2, 3, 4, 5, 6, 7, 8, 21
  test('Sales Report - Date Boundaries, Isolation, Empty Results', async () => {
    // Sept range for A (inv1, inv2, inv4, inv5 included. inv3 excluded, draft excluded)
    const res = await fetch(`${BASE}/reports/sales?startDate=2026-09-01&endDate=2026-09-30`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.strictEqual(res.status, 200);
    const { data } = await res.json();
    assert.strictEqual(data.invoiceCount, 5); // 5 invoices now!
    assert.strictEqual(data.paidAgainstIncludedInvoices, '50000.00'); // From inv4
    // Inv1 (ProdA x2 = 200000 + 18% = 236000)
    // Inv2 (SvcA x1 = 50000 + 18% = 59000)
    // InvEndMidnight (SvcA x1 = 50000 + 18% = 59000)
    // Inv4 (Prod 5 x1 = 100000 + 5% = 105000)
    // Inv5 (Prod Miss x5 = 100000 + 0% = 100000)
    assert.strictEqual(data.salesTotal, '559000.00');

    // Empty range
    const emptyRes = await fetch(`${BASE}/reports/sales?startDate=2020-01-01&endDate=2020-01-31`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    const emptyData = (await emptyRes.json()).data;
    assert.strictEqual(emptyData.invoiceCount, 0);
    assert.strictEqual(emptyData.salesTotal, '0.00');

    // Isolation
    const resB = await fetch(`${BASE}/reports/sales?startDate=2026-09-01&endDate=2026-09-30`, {
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    const dataB = (await resB.json()).data;
    assert.strictEqual(dataB.invoiceCount, 1);
  });

  // Scenarios 22
  test('22. GST Summary totalTax consistency', async () => {
    const res = await fetch(`${BASE}/reports/gst/summary?startDate=2026-09-01&endDate=2026-09-30`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    const { data } = await res.json();
    assert.strictEqual(data.totalTax, (Number(data.cgstTotal) + Number(data.sgstTotal) + Number(data.igstTotal)).toFixed(2));

    // Inv1: 36000, Inv2: 9000, InvEndMidnight: 9000, Inv4: 5000, Inv5: 0 => 59000 total tax
    assert.strictEqual(data.totalTax, '59000.00');
  });

  // Scenarios 14, 23
  test('14, 23. GST Rate-Wise aggregation & consistency', async () => {
    const res = await fetch(`${BASE}/reports/gst/rate-wise?startDate=2026-09-01&endDate=2026-09-30`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    const { data } = await res.json();

    // We expect 3 groups: 0% NON_GST, 5% TAXABLE, 18% TAXABLE
    assert.strictEqual(data.length, 3);

    const rate0 = data.find(r => r.gstRate === 0);
    assert.strictEqual(rate0.taxAmount, '0.00');

    const rate5 = data.find(r => r.gstRate === 5);
    assert.strictEqual(rate5.taxAmount, '5000.00');

    const rate18 = data.find(r => r.gstRate === 18);
    assert.strictEqual(rate18.taxAmount, '54000.00');

    const sumTax = data.reduce((sum, r) => sum + Number(r.taxAmount), 0);
    assert.strictEqual(sumTax.toFixed(2), '59000.00');
  });

  // Scenarios 15, 16, 17, 18, 19, 20, 24
  test('HSN/SAC-Wise aggregation, normalization, pagination, consistency', async () => {
    const res = await fetch(`${BASE}/reports/gst/hsn-wise?startDate=2026-09-01&endDate=2026-09-30&limit=1`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    const { data, pagination } = await res.json();

    assert.strictEqual(pagination.totalRows, 4); // Four distinct groups: HSN 1234, SAC 9988, HSN 7777, HSN Uncategorized
    assert.strictEqual(pagination.limit, 1);
    assert.strictEqual(data.length, 1);

    const fullRes = await fetch(`${BASE}/reports/gst/hsn-wise?startDate=2026-09-01&endDate=2026-09-30`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    const full = await fullRes.json();

    // Deterministic ordering: classificationType ASC, hsnSac ASC
    // HSN 1234 -> HSN 7777 -> HSN Uncategorized -> SAC 9988
    assert.strictEqual(full.data[0].classificationType, 'HSN');
    assert.strictEqual(full.data[0].hsnSac, '1234');

    assert.strictEqual(full.data[1].classificationType, 'HSN');
    assert.strictEqual(full.data[1].hsnSac, '7777');

    assert.strictEqual(full.data[2].classificationType, 'HSN');
    assert.strictEqual(full.data[2].hsnSac, 'Uncategorized');
    assert.strictEqual(full.data[2].taxAmount, '0.00'); // NON_GST

    assert.strictEqual(full.data[3].classificationType, 'SAC');
    assert.strictEqual(full.data[3].hsnSac, '9988');

    // Consistency check
    const sumTax = full.data.reduce((sum, r) => sum + Number(r.taxAmount), 0);
    assert.strictEqual(sumTax.toFixed(2), '59000.00');
  });
});
