const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');
const { runIngestion } = require('../scripts/seed-official-tax-catalogue');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5022;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;

test('Phase 3 & 5 — Official Reference Search, Confirmation & Statutory Invoicing', async (t) => {
  let server;
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUri);
    }
    await runIngestion({ publish: true });
    server = app.listen(TEST_PORT);
  } catch (initErr) {
    console.error('INIT ERROR:', initErr);
    throw initErr;
  }

  const uniqueSuffix = Date.now();

  try {
    // Register Business A
    const regResA = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `ref_a_${uniqueSuffix}@example.com`,
        password: 'Password123!',
        name: 'Ref Business A',
        businessName: 'Business A Corp'
      })
    });
    const dataA = await regResA.json();
    assert.strictEqual(regResA.status, 201, `Failed to register A: ${JSON.stringify(dataA)}`);
    const tokenA = dataA.data.token;
    const businessIdA = dataA.data.business._id;

    // Register Business B
    const regResB = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `ref_b_${uniqueSuffix}@example.com`,
        password: 'Password123!',
        name: 'Ref Business B',
        businessName: 'Business B Corp'
      })
    });
    const dataB = await regResB.json();
    assert.strictEqual(regResB.status, 201, `Failed to register B: ${JSON.stringify(dataB)}`);
    const tokenB = dataB.data.token;

    await t.test('1. Reference Search by Code prefix returns classifications and attached rules', async () => {
      const res = await fetch(`${BASE}/reference/hsn-sac/search?q=8471`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.results.length > 0);
      const item = body.data.results.find(r => r.code === '8471');
      assert.ok(item, 'Should find HSN 8471');
      assert.strictEqual(item.classificationType, 'HSN');
      assert.ok(item.rules.length > 0, 'Should have attached Layer 2 candidate rules');
      assert.strictEqual(item.rules[0].ruleId, 'RULE-8471-COMPUTERS');
      assert.strictEqual(item.rules[0].gstRate, 18);
    });

    await t.test('2. Reference Search by trade alias / keyword', async () => {
      const res = await fetch(`${BASE}/reference/hsn-sac/search?q=laptop`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.results.length > 0);
      const item = body.data.results[0];
      assert.strictEqual(item.code, '8471');
      assert.ok(item.tradeAliases.includes('laptop'));
    });

    await t.test('3. Same-HSN / Multiple-Rule discovery for value slab items (e.g. Footwear 6403)', async () => {
      const res = await fetch(`${BASE}/reference/hsn-sac/search?q=6403`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const footwear = body.data.results.find(r => r.code === '6403');
      assert.ok(footwear);
      assert.strictEqual(footwear.hasMultipleRules, true, 'Footwear should have multiple statutory rules');
      assert.strictEqual(footwear.rules.length, 2);
      
      const slab5 = footwear.rules.find(r => r.gstRate === 5);
      const slab18 = footwear.rules.find(r => r.gstRate === 18);
      assert.ok(slab5, 'Should have 5% slab for <= 2500');
      assert.ok(slab18, 'Should have 18% slab for > 2500');
      assert.strictEqual(slab5.conditionType, 'TRANSACTION_VALUE_SLAB');
    });

    await t.test('4. Fetch rules by code directly', async () => {
      const res = await fetch(`${BASE}/reference/hsn-sac/rules/9983?type=SAC`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.rules.length > 0);
      assert.strictEqual(body.data.classification.code, '9983');
      assert.strictEqual(body.data.rules[0].ruleId, 'RULE-9983-IT-CONSULTING');
    });

    let confirmedConfigIdA = null;

    await t.test('5. Taxpayer confirms statutory rule -> creates Layer 3 TaxConfig with audit trail', async () => {
      const res = await fetch(`${BASE}/tax-config/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          classificationType: 'HSN',
          hsnSac: '8471',
          ruleId: 'RULE-8471-COMPUTERS',
          description: 'Laptops for office development'
        })
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const config = body.data.taxConfig;
      assert.strictEqual(config.hsnSac, '8471');
      assert.strictEqual(config.ruleId, 'RULE-8471-COMPUTERS');
      assert.strictEqual(config.gstRate, 18);
      assert.strictEqual(config.isOfficialReference, true);
      assert.strictEqual(config.isManualOverride, false);
      assert.ok(config.auditTrail.length > 0);
      assert.strictEqual(config.auditTrail[0].action, 'OFFICIAL_SELECTION');
      confirmedConfigIdA = config._id;
    });

    await t.test('6. Taxpayer performs manual override with legal justification', async () => {
      // Missing reason should fail
      const failRes = await fetch(`${BASE}/tax-config/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          classificationType: 'HSN',
          hsnSac: '8471',
          ruleId: 'RULE-8471-CUSTOM',
          isManualOverride: true,
          overrideReasonCategory: 'NONE',
          overrideGstRate: 12
        })
      });
      assert.strictEqual(failRes.status, 400);

      // Valid override succeeds
      const successRes = await fetch(`${BASE}/tax-config/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          classificationType: 'HSN',
          hsnSac: '8471',
          ruleId: 'RULE-8471-CUSTOM',
          isManualOverride: true,
          overrideReasonCategory: 'ADVANCE_RULING',
          overrideReasonDetails: 'AAR Order No 42/2026 granting 12% on specialized hardware',
          overrideGstRate: 12,
          overrideTaxTreatment: 'TAXABLE'
        })
      });
      const successBody = await successRes.json();
      assert.strictEqual(successRes.status, 200, `Override failed: ${JSON.stringify(successBody)}`);
      const config = successBody.data.taxConfig;
      assert.strictEqual(config.gstRate, 12);
      assert.strictEqual(config.isManualOverride, true);
      assert.strictEqual(config.overrideReasonCategory, 'ADVANCE_RULING');
    });

    await t.test('7. Tenant isolation between Business A and Business B', async () => {
      const listResB = await fetch(`${BASE}/tax-config`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert.strictEqual(listResB.status, 200);
      const bodyB = await listResB.json();
      const hasConfigA = bodyB.data.taxConfigs.some(c => c._id === confirmedConfigIdA);
      assert.strictEqual(hasConfigA, false, 'Business B must not see Business A tax configs');
    });

    await t.test('8. End-to-end Invoice Creation with statutory taxConfigId & snapshot verification', async () => {
      // Set Maharashtra GSTIN for Business A
      await fetch(`${BASE}/business/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ gstin: '27AAAAA0000A1Z5', state: 'Maharashtra' })
      });

      // Create customer for Business A
      const custRes = await fetch(`${BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          name: 'Client Alpha',
          customerType: 'Individual',
          gstStatus: 'Unregistered',
          billingAddress: '42 Marine Drive, Mumbai',
          state: 'Maharashtra'
        })
      });
      const custId = (await custRes.json()).data.customer._id;

      // Create item referencing the confirmed TaxConfig
      const itemRes = await fetch(`${BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          name: 'Pro Laptop 16',
          type: 'Product',
          unitPrice: '50000.00',
          taxType: 'Exclusive',
          taxConfigId: confirmedConfigIdA,
          sku: `LAP-${uniqueSuffix}`
        })
      });
      const itemBody = await itemRes.json();
      assert.strictEqual(itemRes.status, 201, `Item creation failed: ${JSON.stringify(itemBody)}`);
      const item = itemBody.data.item;
      assert.strictEqual(item.hsnSac, '8471');

      // Create Draft Invoice
      const invRes = await fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          customerId: custId,
          date: new Date().toISOString(),
          items: [{ itemId: item._id, quantity: 2 }]
        })
      });
      const invBody = await invRes.json();
      assert.strictEqual(invRes.status, 201, `Invoice creation failed: ${JSON.stringify(invBody)}`);
      const inv = invBody.data.invoice;
      const lineItem = inv.items[0];

      // Verify statutory line item snapshot
      assert.strictEqual(lineItem.hsnSac, '8471');
      assert.strictEqual(lineItem.ruleId, 'RULE-8471-COMPUTERS');
      assert.strictEqual(lineItem.taxConfigId, confirmedConfigIdA);
      assert.strictEqual(lineItem.gstRate, 18);
      assert.strictEqual(lineItem.cgstRate, 9);
      assert.strictEqual(lineItem.sgstRate, 9);
      assert.strictEqual(lineItem.taxableValue, '100000.00');
      assert.strictEqual(lineItem.cgst, '9000.00');
      assert.strictEqual(lineItem.sgst, '9000.00');
      assert.strictEqual(lineItem.taxAmount, '18000.00');
      assert.strictEqual(lineItem.lineTotal, '118000.00');
      assert.strictEqual(inv.summary.grandTotal, '118000.00');
    });

  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
});
