const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5005;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

test('Phase 7 — Products & Services', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    // Register User A
    const regARes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Item User A',
        email: `itema_${uid}@test.com`,
        password: 'password123',
        businessName: 'Item Business A'
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
        name: 'Item User B',
        email: `itemb_${uid}@test.com`,
        password: 'password456',
        businessName: 'Item Business B'
      })
    });
    const regBData = await regBRes.json();
    const tokenB = regBData.data.token;
    const businessBId = regBData.data.business._id;

    // ===========================
    // 1. Unauthenticated requests rejected
    // ===========================
    const unauthRes = await fetch(`${BASE}/items`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated GET should return 401');

    // ===========================
    // 2. Create a Product
    // ===========================
    const createProdRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Widget A',
        type: 'Product',
        sku: `WID-${uid}`,
        unit: 'pcs',
        unitPrice: 10050,
        costPrice: 7500,
        currentStock: 100,
        lowStockThreshold: 10,
        description: 'A test widget',
        notes: 'Sample product note'
      })
    });
    const createProdData = await createProdRes.json();
    assert.strictEqual(createProdRes.status, 201, 'Create Product should return 201');
    assert.strictEqual(createProdData.data.item.name, 'Widget A');
    assert.strictEqual(createProdData.data.item.type, 'Product');
    assert.strictEqual(createProdData.data.item.currentStock, 100);
    assert.strictEqual(createProdData.data.item.costPrice, '7500.00');

    // 4. Verify server-derived businessId
    assert.strictEqual(createProdData.data.item.businessId, businessAId, 'Item must belong to Business A');

    const productIdA = createProdData.data.item._id;

    // ===========================
    // 3. Create a Service
    // ===========================
    const createSvcRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Consulting',
        type: 'Service',
        unit: 'hr',
        unitPrice: 500000,
        description: 'Business consulting service'
      })
    });
    const createSvcData = await createSvcRes.json();
    assert.strictEqual(createSvcRes.status, 201, 'Create Service should return 201');
    assert.strictEqual(createSvcData.data.item.type, 'Service');

    // 18. Service stock behavior — stock fields must be null
    assert.strictEqual(createSvcData.data.item.currentStock, null, 'Service currentStock must be null');
    assert.strictEqual(createSvcData.data.item.lowStockThreshold, null, 'Service lowStockThreshold must be null');
    assert.strictEqual(createSvcData.data.item.costPrice, null, 'Service costPrice must be null');

    const serviceIdA = createSvcData.data.item._id;

    // ===========================
    // 5. List own items
    // ===========================
    const listRes = await fetch(`${BASE}/items`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200, 'List items should return 200');
    assert.strictEqual(listData.data.items.length, 2, 'Should have 2 items');

    // ===========================
    // 6. Retrieve own item
    // ===========================
    const getRes = await fetch(`${BASE}/items/${productIdA}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getData = await getRes.json();
    assert.strictEqual(getRes.status, 200, 'Get item should return 200');
    assert.strictEqual(getData.data.item._id, productIdA);

    // ===========================
    // 7. Update own item
    // ===========================
    const updateRes = await fetch(`${BASE}/items/${productIdA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Widget A Pro', unitPrice: 12000 })
    });
    const updateData = await updateRes.json();
    assert.strictEqual(updateRes.status, 200, 'Update item should return 200');
    assert.strictEqual(updateData.data.item.name, 'Widget A Pro');
    assert.strictEqual(updateData.data.item.unitPrice, '12000.00');

    // ===========================
    // 9-11. Cross-business isolation
    // ===========================
    const getBRes = await fetch(`${BASE}/items/${productIdA}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(getBRes.status, 404, 'User B should get 404 for User A item');

    const updateBRes = await fetch(`${BASE}/items/${productIdA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ name: 'Hacked Widget' })
    });
    assert.strictEqual(updateBRes.status, 404, 'User B cannot update User A item');

    const deleteBRes = await fetch(`${BASE}/items/${productIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(deleteBRes.status, 404, 'User B cannot delete User A item');

    // ===========================
    // 12. Client-supplied businessId rejected by strict validation
    // ===========================
    const spoofRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Spoofed Item',
        type: 'Product',
        unitPrice: 1000,
        businessId: businessBId
      })
    });
    assert.strictEqual(spoofRes.status, 400, 'businessId in body should be rejected by strict validation');

    // ===========================
    // 13. Protected fields cannot be overwritten
    // ===========================
    const protectRes = await fetch(`${BASE}/items/${productIdA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ _id: '654321654321654321654321', businessId: businessBId })
    });
    assert.strictEqual(protectRes.status, 400, 'Protected fields should be rejected');

    // ===========================
    // 14. Invalid monetary values rejected
    // ===========================
    const negPriceRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Bad Price', type: 'Product', unitPrice: -100 })
    });
    assert.strictEqual(negPriceRes.status, 400, 'Negative unitPrice should be rejected');

    // ===========================
    // 15. Invalid stock values rejected
    // ===========================
    const negStockRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Bad Stock', type: 'Product', unitPrice: 100, currentStock: -5 })
    });
    assert.strictEqual(negStockRes.status, 400, 'Negative stock should be rejected');

    // ===========================
    // 16. Invalid item type rejected
    // ===========================
    const badTypeRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Bad Type', type: 'Widget', unitPrice: 100 })
    });
    assert.strictEqual(badTypeRes.status, 400, 'Invalid type should be rejected');

    // ===========================
    // 17. Product stock behavior — stock fields preserved
    // ===========================
    assert.strictEqual(createProdData.data.item.currentStock, 100, 'Product should retain stock');

    // ===========================
    // 19. Invalid ObjectId handled safely
    // ===========================
    const badIdRes = await fetch(`${BASE}/items/invalid-id`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(badIdRes.status, 400, 'Invalid ObjectId should return 400');

    // ===========================
    // 20. Duplicate SKU behavior
    // ===========================
    const dupSkuRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Duplicate SKU Item',
        type: 'Product',
        sku: `WID-${uid}`,
        unitPrice: 5000
      })
    });
    assert.strictEqual(dupSkuRes.status, 409, 'Duplicate SKU within same business should return 409');

    // Same SKU for different business should work
    const dupSkuBRes = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        name: 'Widget B',
        type: 'Product',
        sku: `WID-${uid}`,
        unitPrice: 5000
      })
    });
    assert.strictEqual(dupSkuBRes.status, 201, 'Same SKU for different business should be allowed');

    // Multiple items without SKU within same business should be allowed (verifying partialFilterExpression index)
    const noSku1Res = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'No SKU Item 1',
        type: 'Service',
        unitPrice: 1000
      })
    });
    assert.strictEqual(noSku1Res.status, 201, 'First item without SKU in Business A should return 201');

    const noSku2Res = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'No SKU Item 2',
        type: 'Service',
        unitPrice: 2000
      })
    });
    assert.strictEqual(noSku2Res.status, 201, 'Second item without SKU in same Business A should return 201');

    const bItemId = (await dupSkuBRes.json()).data.item._id;

    // ===========================
    // 8. Delete own item
    // ===========================
    const deleteRes = await fetch(`${BASE}/items/${productIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(deleteRes.status, 200, 'Delete item should return 200');

    const checkRes = await fetch(`${BASE}/items/${productIdA}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(checkRes.status, 404, 'Deleted item should return 404');

    // ===========================
    // PHASE 20 - Financial Precision Update Validation
    // ===========================
    const ItemModel = require('../src/models/Item');
    const updateItem = new ItemModel({
      businessId: businessAId,
      type: 'Product',
      name: 'Update Validation Item',
      sku: 'TEST-SKU-' + Date.now(),
      unitPrice: 1000
    });
    await updateItem.save();

    // Negative: try to write excess decimal places using Mongoose update path with runValidators
    let updateErr = null;
    try {
      await ItemModel.findOneAndUpdate(
        { _id: updateItem._id, businessId: businessAId },
        { $set: { unitPrice: 100.555 } },
        { returnDocument: 'after', runValidators: true }
      );
    } catch (e) {
      updateErr = e;
    }
    assert.ok(updateErr, 'Mongoose findOneAndUpdate should reject excess decimal unitPrice with runValidators');

    // Verify stored value remains unchanged
    const unchangedItem = await ItemModel.findById(updateItem._id);
    assert.strictEqual(unchangedItem.unitPrice.toString(), '1000.00', 'unitPrice must remain unchanged after failed excess decimal update');

    // Positive: valid rupee update succeeds
    const successItem = await ItemModel.findOneAndUpdate(
      { _id: updateItem._id, businessId: businessAId },
      { $set: { unitPrice: '2000.50' } },
      { returnDocument: 'after', runValidators: true }
    );
    assert.strictEqual(successItem.unitPrice.toString(), '2000.50', 'unitPrice must update to new rupee value');

    // ===========================
    // CLEANUP
    // ===========================
    const User = require('../src/models/User');
    const Business = require('../src/models/Business');
    const Item = require('../src/models/Item');
    await Item.deleteMany({ businessId: { $in: [businessAId, businessBId] } });
    await User.deleteMany({ email: { $in: [`itema_${uid}@test.com`, `itemb_${uid}@test.com`] } });
    await Business.deleteMany({ _id: { $in: [businessAId, businessBId] } });

  } finally {
    server.close();
    await mongoose.disconnect();
  }
});
