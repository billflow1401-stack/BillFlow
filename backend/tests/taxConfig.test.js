const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5006;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

// ============================================================
// UNIT TESTS: GST Calculation Engine (no server required)
// ============================================================
const { calculateGST, determineSupplyType, SUPPLY_TYPE, PRICING_MODE, TAX_TREATMENT } = require('../src/services/gstCalculation.service');

test('GST Engine — 18% Exclusive Intra-State', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 18,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(result.taxableAmount, '100000.00');
  assert.strictEqual(result.totalGST, '18000.00');
  assert.strictEqual(result.cgst, '9000.00');
  assert.strictEqual(result.sgst, '9000.00');
  assert.strictEqual(result.igst, '0.00');
  assert.strictEqual(result.total, '118000.00');
});

test('GST Engine — 18% Inclusive Intra-State', () => {
  const result = calculateGST({
    amount: 118000, gstRate: 18,
    pricingMode: 'INCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(result.taxableAmount, '100000.00');
  assert.strictEqual(result.totalGST, '18000.00');
  assert.strictEqual(result.cgst, '9000.00');
  assert.strictEqual(result.sgst, '9000.00');
  assert.strictEqual(result.igst, '0.00');
  assert.strictEqual(result.total, '118000.00');
});

test('GST Engine — 18% Exclusive Inter-State', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 18,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTER_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(result.taxableAmount, '100000.00');
  assert.strictEqual(result.cgst, '0.00');
  assert.strictEqual(result.sgst, '0.00');
  assert.strictEqual(result.igst, '18000.00');
  assert.strictEqual(result.totalGST, '18000.00');
  assert.strictEqual(result.total, '118000.00');
});

test('GST Engine — 0% Taxable', () => {
  const result = calculateGST({
    amount: 50000, gstRate: 0,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(result.taxableAmount, '50000.00');
  assert.strictEqual(result.totalGST, '0.00');
  assert.strictEqual(result.total, '50000.00');
});

test('GST Engine — 5% Exclusive', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 5,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(result.taxableAmount, '100000.00');
  assert.strictEqual(result.totalGST, '5000.00');
  assert.strictEqual(result.cgst, '2500.00');
  assert.strictEqual(result.sgst, '2500.00');
  assert.strictEqual(result.total, '105000.00');
});

test('GST Engine — 12% Exclusive', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 12,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(result.taxableAmount, '100000.00');
  assert.strictEqual(result.totalGST, '12000.00');
  assert.strictEqual(result.cgst, '6000.00');
  assert.strictEqual(result.sgst, '6000.00');
  assert.strictEqual(result.total, '112000.00');
});

test('GST Engine — 28% Exclusive', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 28,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(result.taxableAmount, '100000.00');
  assert.strictEqual(result.totalGST, '28000.00');
  assert.strictEqual(result.cgst, '14000.00');
  assert.strictEqual(result.sgst, '14000.00');
  assert.strictEqual(result.total, '128000.00');
});

test('GST Engine — EXEMPT returns zero GST', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 18,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'EXEMPT'
  });
  assert.strictEqual(result.totalGST, '0.00');
  assert.strictEqual(result.cgst, '0.00');
  assert.strictEqual(result.sgst, '0.00');
  assert.strictEqual(result.igst, '0.00');
  assert.strictEqual(result.total, '100000.00');
});

test('GST Engine — NIL_RATED returns zero GST', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 18,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'NIL_RATED'
  });
  assert.strictEqual(result.totalGST, '0.00');
  assert.strictEqual(result.total, '100000.00');
});

test('GST Engine — NON_GST returns zero GST', () => {
  const result = calculateGST({
    amount: 100000, gstRate: 18,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'NON_GST'
  });
  assert.strictEqual(result.totalGST, '0.00');
  assert.strictEqual(result.total, '100000.00');
});

test('GST Engine — 2-decimal rupee outputs', () => {
  // Number that could produce complex fractions
  const result = calculateGST({
    amount: '99999.99', gstRate: 18,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.ok(/^\d+\.\d{2}$/.test(result.taxableAmount), 'taxableAmount must be 2-decimal string');
  assert.ok(/^\d+\.\d{2}$/.test(result.cgst), 'cgst must be 2-decimal string');
  assert.ok(/^\d+\.\d{2}$/.test(result.sgst), 'sgst must be 2-decimal string');
  assert.ok(/^\d+\.\d{2}$/.test(result.igst), 'igst must be 2-decimal string');
  assert.ok(/^\d+\.\d{2}$/.test(result.totalGST), 'totalGST must be 2-decimal string');
  assert.ok(/^\d+\.\d{2}$/.test(result.total), 'total must be 2-decimal string');
  // Verify CGST + SGST = totalGST
  assert.strictEqual((Number(result.cgst) + Number(result.sgst)).toFixed(2), result.totalGST);
});

test('GST Engine — Deterministic rounding', () => {
  // Run same input twice, must produce identical results
  const input = {
    amount: '33333.33', gstRate: 18,
    pricingMode: 'INCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  };
  const r1 = calculateGST(input);
  const r2 = calculateGST(input);
  assert.deepStrictEqual(r1, r2, 'Same input must produce identical results');
  assert.ok(/^\d+\.\d{2}$/.test(r1.taxableAmount));
  assert.ok(/^\d+\.\d{2}$/.test(r1.totalGST));
  assert.strictEqual((Number(r1.taxableAmount) + Number(r1.totalGST)).toFixed(2), r1.total);
});

test('GST Engine — No negative tax values', () => {
  const result = calculateGST({
    amountPaise: 1, gstRate: 5,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.ok(result.cgst >= 0);
  assert.ok(result.sgst >= 0);
  assert.ok(result.totalGST >= 0);
});

test('GST Engine — Invalid rate rejected', () => {
  assert.throws(() => {
    calculateGST({
      amountPaise: 100000, gstRate: -5,
      pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE'
    });
  });
});

test('GST Engine — Multiple different rates', () => {
  const r5 = calculateGST({
    amount: 100000, gstRate: 5,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  const r18 = calculateGST({
    amount: 100000, gstRate: 18,
    pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE', taxTreatment: 'TAXABLE'
  });
  assert.strictEqual(r5.totalGST, '5000.00');
  assert.strictEqual(r18.totalGST, '18000.00');
  assert.notStrictEqual(r5.totalGST, r18.totalGST);
});

test('GST Engine — Supply type determination', () => {
  assert.strictEqual(determineSupplyType('Maharashtra', 'Maharashtra'), 'INTRA_STATE');
  assert.strictEqual(determineSupplyType('Maharashtra', 'Karnataka'), 'INTER_STATE');
  assert.strictEqual(determineSupplyType('  Maharashtra ', ' maharashtra'), 'INTRA_STATE');
  assert.strictEqual(determineSupplyType(null, 'Karnataka'), 'INTRA_STATE');
});

// ============================================================
// INTEGRATION TESTS: API endpoints (server required)
// ============================================================
test('Phase 8 — HSN/SAC + GST Config API', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    // Register User A
    const regARes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tax User A', email: `taxa_${uid}@test.com`,
        password: 'password123', businessName: 'Tax Business A'
      })
    });
    const regAData = await regARes.json();
    const tokenA = regAData.data.token;
    const businessAId = regAData.data.business._id;

    // Register User B
    const regBRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tax User B', email: `taxb_${uid}@test.com`,
        password: 'password456', businessName: 'Tax Business B'
      })
    });
    const regBData = await regBRes.json();
    const tokenB = regBData.data.token;

    // 26. Unauthenticated access rejected
    const unauthRes = await fetch(`${BASE}/tax-config`);
    assert.strictEqual(unauthRes.status, 401);

    // 1. Create valid HSN configuration
    const createHsnRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        hsnSac: '84713010',
        classificationType: 'HSN',
        description: 'Laptop computers',
        gstRate: 18,
        taxTreatment: 'TAXABLE',
        sourceReference: 'Sample reference data'
      })
    });
    const createHsnData = await createHsnRes.json();
    assert.strictEqual(createHsnRes.status, 201);
    assert.strictEqual(createHsnData.data.taxConfig.hsnSac, '84713010');
    assert.strictEqual(createHsnData.data.taxConfig.classificationType, 'HSN');
    assert.strictEqual(createHsnData.data.taxConfig.businessId, businessAId);
    const hsnId = createHsnData.data.taxConfig._id;

    // 2. Create valid SAC configuration
    const createSacRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        hsnSac: '998311',
        classificationType: 'SAC',
        description: 'Management consulting services',
        gstRate: 18,
        taxTreatment: 'TAXABLE'
      })
    });
    assert.strictEqual(createSacRes.status, 201);
    const sacId = (await createSacRes.json()).data.taxConfig._id;

    // Add another HSN for lookup tests
    await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        hsnSac: '84714100',
        classificationType: 'HSN',
        description: 'Desktop computers',
        gstRate: 18,
        taxTreatment: 'TAXABLE'
      })
    });

    // 3. Lookup by code (prefix match)
    const lookupCodeRes = await fetch(`${BASE}/tax-config/lookup?code=8471`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const lookupCodeData = await lookupCodeRes.json();
    assert.strictEqual(lookupCodeRes.status, 200);
    assert.ok(lookupCodeData.data.results.length >= 2, 'Should find at least 2 results for prefix 8471');

    // 4. Lookup by description
    const lookupDescRes = await fetch(`${BASE}/tax-config/lookup?description=consulting`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const lookupDescData = await lookupDescRes.json();
    assert.strictEqual(lookupDescRes.status, 200);
    assert.ok(lookupDescData.data.results.length >= 1);

    // 5. Invalid code rejected
    const invalidCodeRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        hsnSac: 'ABCD',
        classificationType: 'HSN',
        gstRate: 18
      })
    });
    assert.strictEqual(invalidCodeRes.status, 400, 'Non-numeric HSN should be rejected');

    // 6. Invalid classification type rejected
    const invalidTypeRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        hsnSac: '1234',
        classificationType: 'INVALID',
        gstRate: 18
      })
    });
    assert.strictEqual(invalidTypeRes.status, 400);

    // 7. Invalid tax treatment rejected
    const invalidTreatmentRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        hsnSac: '5555',
        classificationType: 'HSN',
        gstRate: 18,
        taxTreatment: 'INVALID'
      })
    });
    assert.strictEqual(invalidTreatmentRes.status, 400);

    // 8. Business isolation — User B cannot access User A's config
    const getBRes = await fetch(`${BASE}/tax-config/${hsnId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(getBRes.status, 404);

    // 27-29. User A's config invisible to User B
    const updateBRes = await fetch(`${BASE}/tax-config/${hsnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ gstRate: 28 })
    });
    assert.strictEqual(updateBRes.status, 404);

    const deleteBRes = await fetch(`${BASE}/tax-config/${hsnId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(deleteBRes.status, 404);

    // 30. Client-supplied businessId rejected
    const spoofRes = await fetch(`${BASE}/tax-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        hsnSac: '9999',
        classificationType: 'HSN',
        gstRate: 5,
        businessId: 'fake-id'
      })
    });
    assert.strictEqual(spoofRes.status, 400, 'businessId in body rejected by strict validation');

    // 31. Protected fields rejected
    const protectRes = await fetch(`${BASE}/tax-config/${hsnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ _id: 'fake', businessId: 'fake' })
    });
    assert.strictEqual(protectRes.status, 400);

    // Tax calculation API tests
    // Exclusive 18% intra-state
    const calcRes = await fetch(`${BASE}/tax-config/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        amount: 100000, gstRate: 18,
        pricingMode: 'EXCLUSIVE', supplyType: 'INTRA_STATE'
      })
    });
    const calcData = await calcRes.json();
    assert.strictEqual(calcRes.status, 200);
    assert.strictEqual(calcData.data.calculation.taxableAmount, '100000.00');
    assert.strictEqual(calcData.data.calculation.cgst, '9000.00');
    assert.strictEqual(calcData.data.calculation.sgst, '9000.00');
    assert.strictEqual(calcData.data.calculation.total, '118000.00');

    // Inclusive 18% intra-state via API
    const calcInclRes = await fetch(`${BASE}/tax-config/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        amount: 118000, gstRate: 18,
        pricingMode: 'INCLUSIVE', supplyType: 'INTRA_STATE'
      })
    });
    const calcInclData = await calcInclRes.json();
    assert.strictEqual(calcInclData.data.calculation.taxableAmount, '100000.00');
    assert.strictEqual(calcInclData.data.calculation.totalGST, '18000.00');

    // CLEANUP
    const TaxConfig = require('../src/models/TaxConfig');
    const User = require('../src/models/User');
    const Business = require('../src/models/Business');
    await TaxConfig.deleteMany({ businessId: businessAId });
    await User.deleteMany({ email: { $in: [`taxa_${uid}@test.com`, `taxb_${uid}@test.com`] } });
    await Business.deleteMany({ _id: { $in: [businessAId, (await regBRes.json().catch(() => ({}))).data?.business?._id].filter(Boolean) } });

  } finally {
    server.close();
    await mongoose.disconnect();
  }
});

// ============================================================
// INTEGRATION TESTS: Seed Script
// ============================================================
test('Phase 8 — Seed Script Idempotency and Business Isolation', async (t) => {
  await mongoose.connect(env.mongoUri);

  const TaxConfig = require('../src/models/TaxConfig');
  const { seedTaxConfigs, DEMO_TAX_CONFIGS } = require('../scripts/seed-tax-config');
  const businessId1 = new mongoose.Types.ObjectId();
  const businessId2 = new mongoose.Types.ObjectId();

  try {
    // 1. First run creates records
    const run1 = await seedTaxConfigs(businessId1);
    assert.strictEqual(run1.created, DEMO_TAX_CONFIGS.length, 'All demo records should be created');
    assert.strictEqual(run1.updated, 0, 'No records should be updated on first run');

    // Verify HSN/SAC counts and properties
    const configs1 = await TaxConfig.find({ businessId: businessId1 });
    assert.strictEqual(configs1.length, DEMO_TAX_CONFIGS.length);

    // Check multiple rates exist
    const rates = configs1.map(c => c.gstRate);
    assert.ok(rates.includes(0));
    assert.ok(rates.includes(5));
    assert.ok(rates.includes(12));
    assert.ok(rates.includes(18));
    assert.ok(rates.includes(28));

    // Check HSN and SAC both exist
    const hasHSN = configs1.some(c => c.classificationType === 'HSN');
    const hasSAC = configs1.some(c => c.classificationType === 'SAC');
    assert.ok(hasHSN, 'Should have HSN records');
    assert.ok(hasSAC, 'Should have SAC records');

    // 2. Second run is idempotent
    const run2 = await seedTaxConfigs(businessId1);
    assert.strictEqual(run2.created, 0, 'No new records should be created on second run');
    assert.strictEqual(run2.updated, DEMO_TAX_CONFIGS.length, 'All records should be updated (upsert existing)');

    // 3. Business isolation: Seed for another business
    const run3 = await seedTaxConfigs(businessId2);
    assert.strictEqual(run3.created, DEMO_TAX_CONFIGS.length, 'Should create new records for new businessId');

    // Verify business isolation
    const totalConfigs = await TaxConfig.countDocuments({ businessId: { $in: [businessId1, businessId2] } });
    assert.strictEqual(totalConfigs, DEMO_TAX_CONFIGS.length * 2, 'Records must be isolated per business');

  } finally {
    // Cleanup
    await TaxConfig.deleteMany({ businessId: { $in: [businessId1, businessId2] } });
    await mongoose.disconnect();
  }
});
