const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');
const Item = require('../src/models/Item');
const StockMovement = require('../src/models/StockMovement');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5019;
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

test('On-Demand Line Items: Creation & Catalogue Auto-Addition on Finalize', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    const user = await setupUser('ondemand');

    await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ state: 'Maharashtra', invoiceSettings: { prefix: 'ONDEMAND-' } })
    });

    await t.test('1. Draft invoice with ad-hoc Product and Service computes totals correctly', async () => {
      const draftRes = await fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          billingMode: 'General',
          quickCustomer: { name: 'Customer Priya', phone: '9876543210' },
          date: new Date().toISOString(),
          items: [
            {
              name: 'Special Custom Widget',
              type: 'Product',
              quantity: 2,
              unitPriceOverride: '500.00'
            },
            {
              name: 'Express Installation Service',
              type: 'Service',
              quantity: 1,
              unitPriceOverride: '350.00'
            }
          ]
        })
      });

      assert.strictEqual(draftRes.status, 201);
      const draftData = await draftRes.json();
      const inv = draftData.data.invoice;

      assert.strictEqual(inv.status, 'Draft');
      assert.strictEqual(inv.items.length, 2);
      assert.strictEqual(inv.items[0].name, 'Special Custom Widget');
      assert.strictEqual(inv.items[0].type, 'Product');
      assert.strictEqual(inv.items[0].unitPrice, '500.00');
      assert.strictEqual(inv.items[0].quantity, 2);
      assert.strictEqual(inv.items[0].lineTotal, '1000.00');

      assert.strictEqual(inv.items[1].name, 'Express Installation Service');
      assert.strictEqual(inv.items[1].type, 'Service');
      assert.strictEqual(inv.items[1].unitPrice, '350.00');
      assert.strictEqual(inv.items[1].lineTotal, '350.00');

      assert.strictEqual(inv.summary.grandTotal, '1350.00');

      // Check that items do NOT exist in the Item collection yet
      const preCheckProduct = await Item.findOne({ businessId: user.businessId, name: 'Special Custom Widget' });
      assert.strictEqual(preCheckProduct, null, 'Ad-hoc item must not exist in catalogue during draft');
    });

    await t.test('2. Finalizing invoice adds items to catalogue with single-unit price and 0 stock for product', async () => {
      // Create draft to finalize
      const draftRes = await fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          billingMode: 'General',
          quickCustomer: { name: 'Customer Rohan' },
          date: new Date().toISOString(),
          items: [
            {
              name: 'On-Demand Gaming Mouse',
              type: 'Product',
              quantity: 2,
              unitPriceOverride: '500.00'
            },
            {
              name: 'Setup & Configuration',
              type: 'Service',
              quantity: 1,
              unitPriceOverride: '200.00'
            }
          ]
        })
      });

      const draftData = await draftRes.json();
      const invoiceId = draftData.data.invoice._id;

      // Finalize the invoice
      const finalizeRes = await fetch(`${BASE}/invoices/${invoiceId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }
      });

      assert.strictEqual(finalizeRes.status, 200);
      const finalizeData = await finalizeRes.json();
      const finalizedInv = finalizeData.data.invoice;

      assert.strictEqual(finalizedInv.status, 'Unpaid');
      assert.match(finalizedInv.invoiceNumber, /^ONDEMAND-\d{4}$/);

      // Verify Product in catalogue:
      const productInDb = await Item.findOne({ businessId: user.businessId, name: 'On-Demand Gaming Mouse' });
      assert.ok(productInDb, 'Product must be created in catalogue on finalize');
      assert.strictEqual(productInDb.type, 'Product');
      // Unit price must be the price of ONE item (500.00), not total (1000.00)
      assert.strictEqual(productInDb.unitPrice, '500.00');
      // Stock should be 0 because 2 were ordered and 2 were deducted for invoice
      assert.strictEqual(productInDb.currentStock, 0);

      // Check stock movement OUT
      const movements = await StockMovement.find({ businessId: user.businessId, itemId: productInDb._id });
      assert.strictEqual(movements.length, 1);
      assert.strictEqual(movements[0].movementType, 'OUT');
      assert.strictEqual(movements[0].quantity, 2);
      assert.strictEqual(movements[0].balanceBefore, 2);
      assert.strictEqual(movements[0].balanceAfter, 0);

      // Verify Service in catalogue:
      const serviceInDb = await Item.findOne({ businessId: user.businessId, name: 'Setup & Configuration' });
      assert.ok(serviceInDb, 'Service must be created in catalogue on finalize');
      assert.strictEqual(serviceInDb.type, 'Service');
      assert.strictEqual(serviceInDb.unitPrice, '200.00');
      assert.strictEqual(serviceInDb.currentStock, null);
    });

  } finally {
    server.close();
    await mongoose.disconnect();
  }
});
