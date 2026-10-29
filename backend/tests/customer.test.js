const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5004;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

test('Phase 6 — Customer Management', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    // Register User A
    const regARes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cust User A',
        email: `custa_${uid}@test.com`,
        password: 'password123',
        businessName: 'Cust Business A'
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
        name: 'Cust User B',
        email: `custb_${uid}@test.com`,
        password: 'password456',
        businessName: 'Cust Business B'
      })
    });
    const regBData = await regBRes.json();
    const tokenB = regBData.data.token;
    const businessBId = regBData.data.business._id;

    // ===========================
    // 1. Unauthenticated rejection
    // ===========================
    const unauthRes = await fetch(`${BASE}/customers`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated GET should return 401');

    // ===========================
    // 2. Create customer (User A)
    // ===========================
    const createRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Acme Corp',
        customerType: 'Business',
        email: 'contact@acme.com',
        phone: '1234567890',
        gstin: '27AAAAA0000A1Z5'
      })
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201, 'Create customer should return 201');
    assert.strictEqual(createData.data.customer.name, 'Acme Corp');
    // 3. Verify server-derived businessId
    assert.strictEqual(createData.data.customer.businessId, businessAId, 'Customer must be assigned to Business A');
    
    const customerIdA = createData.data.customer._id;

    // ===========================
    // 4. List customers (User A)
    // ===========================
    const listRes = await fetch(`${BASE}/customers`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200, 'List customers should return 200');
    assert.strictEqual(listData.data.customers.length, 1);
    assert.strictEqual(listData.data.customers[0]._id, customerIdA);

    // ===========================
    // 5. Get single customer (User A)
    // ===========================
    const getRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getData = await getRes.json();
    assert.strictEqual(getRes.status, 200, 'Get customer should return 200');
    assert.strictEqual(getData.data.customer._id, customerIdA);

    // ===========================
    // 6. Update customer (User A)
    // ===========================
    const updateRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Acme Corporation' })
    });
    const updateData = await updateRes.json();
    assert.strictEqual(updateRes.status, 200, 'Update customer should return 200');
    assert.strictEqual(updateData.data.customer.name, 'Acme Corporation');

    // ===========================
    // 8. User B cannot retrieve User A's customer
    // ===========================
    const getBRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(getBRes.status, 404, 'User B should get 404 for User A customer');

    // ===========================
    // 9. User B cannot update User A's customer
    // ===========================
    const updateBRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ name: 'Hacked Corp' })
    });
    assert.strictEqual(updateBRes.status, 404, 'User B should get 404 when trying to update User A customer');

    // ===========================
    // 10. User B cannot delete User A's customer
    // ===========================
    const deleteBRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(deleteBRes.status, 404, 'User B should get 404 when trying to delete User A customer');

    // ===========================
    // 11. Client-supplied businessId cannot override server-derived ownership
    // ===========================
    const createSpoofRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Spoofed Corp',
        businessId: businessBId // Trying to assign to Business B
      })
    });
    assert.strictEqual(createSpoofRes.status, 400, 'Spoofed businessId should be rejected by strict validation');

    // ===========================
    // 12. Protected fields cannot be overwritten
    // ===========================
    const protectRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ _id: '654321654321654321654321', businessId: businessBId })
    });
    assert.strictEqual(protectRes.status, 400, 'Protected fields in PATCH body should be rejected by validation');

    // ===========================
    // 13. Invalid data rejected
    // ===========================
    const invalidRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: '', email: 'not-an-email' }) // Empty name and invalid email
    });
    assert.strictEqual(invalidRes.status, 400);

    // ===========================
    // 14. Invalid ObjectId handled safely
    // ===========================
    const badIdRes = await fetch(`${BASE}/customers/invalid-id`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(badIdRes.status, 400, 'Invalid ObjectId should return 400');

    // ===========================
    // 7. Delete customer (User A)
    // ===========================
    const deleteRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(deleteRes.status, 200, 'Delete customer should return 200');

    const checkRes = await fetch(`${BASE}/customers/${customerIdA}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(checkRes.status, 404, 'Deleted customer should return 404');

    // ===========================
    // CLEANUP
    // ===========================
    const User = require('../src/models/User');
    const Business = require('../src/models/Business');
    const Customer = require('../src/models/Customer');
    await User.deleteMany({ email: { $in: [`custa_${uid}@test.com`, `custb_${uid}@test.com`] } });
    await Business.deleteMany({ _id: { $in: [businessAId, businessBId] } });
    await Customer.deleteMany({ _id: { $in: [customerIdA] } });

  } finally {
    server.close();
    await mongoose.disconnect();
  }
});
