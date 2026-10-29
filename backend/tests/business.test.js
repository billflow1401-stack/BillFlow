const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5003;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;
const uid = Date.now();

test('Phase 5 — Business Profile', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    // Register User A
    const regARes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Profile User A',
        email: `profilea_${uid}@test.com`,
        password: 'password123',
        businessName: 'Profile Business A'
      })
    });
    const regAData = await regARes.json();
    assert.strictEqual(regARes.status, 201);
    const tokenA = regAData.data.token;
    const businessAId = regAData.data.business._id;

    // Register User B
    const regBRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Profile User B',
        email: `profileb_${uid}@test.com`,
        password: 'password456',
        businessName: 'Profile Business B'
      })
    });
    const regBData = await regBRes.json();
    assert.strictEqual(regBRes.status, 201);
    const tokenB = regBData.data.token;
    const businessBId = regBData.data.business._id;

    // ===========================
    // 1. GET own business profile
    // ===========================
    const getRes = await fetch(`${BASE}/business/profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getData = await getRes.json();
    assert.strictEqual(getRes.status, 200, 'GET profile should return 200');
    assert.strictEqual(getData.data.business.name, 'Profile Business A');
    assert.strictEqual(getData.data.business._id, businessAId);

    // ===========================
    // 2. PATCH own business profile
    // ===========================
    const patchRes = await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Updated Business A',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400001',
        gstin: '27AAAAA0000A1Z5',
        pan: 'AAAAA0000A',
        phone: '9876543210',
        email: 'biz@example.com',
        bankDetails: {
          bankName: 'State Bank',
          accountNumber: '1234567890',
          ifsc: 'SBIN0000001',
          branchName: 'Main Branch'
        },
        invoiceSettings: {
          prefix: 'BIZ-',
          notes: 'Thank you for your business'
        }
      })
    });
    const patchData = await patchRes.json();
    assert.strictEqual(patchRes.status, 200, 'PATCH profile should return 200');
    assert.strictEqual(patchData.data.business.name, 'Updated Business A');
    assert.strictEqual(patchData.data.business.city, 'Mumbai');
    assert.strictEqual(patchData.data.business.gstin, '27AAAAA0000A1Z5');
    assert.strictEqual(patchData.data.business.bankDetails.ifsc, 'SBIN0000001');
    assert.strictEqual(patchData.data.business.invoiceSettings.prefix, 'BIZ-');
    assert.strictEqual(patchData.data.business.invoiceSettings.notes, 'Thank you for your business');

    // Verify persistence
    const getAfterRes = await fetch(`${BASE}/business/profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getAfterData = await getAfterRes.json();
    assert.strictEqual(getAfterData.data.business.name, 'Updated Business A');

    // ===========================
    // 3. Unauthenticated access rejected
    // ===========================
    const unauthRes = await fetch(`${BASE}/business/profile`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated GET should return 401');

    // ===========================
    // 4. User A cannot access User B's business
    // ===========================
    const getARes = await fetch(`${BASE}/business/profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getAData = await getARes.json();
    assert.strictEqual(getAData.data.business._id, businessAId, 'User A must see only Business A');

    const getBRes = await fetch(`${BASE}/business/profile`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const getBData = await getBRes.json();
    assert.strictEqual(getBData.data.business._id, businessBId, 'User B must see only Business B');
    assert.notStrictEqual(getAData.data.business._id, getBData.data.business._id, 'Businesses must be isolated');

    // ===========================
    // 5. User A cannot update User B's business
    // ===========================
    // User A updates — should only affect Business A
    await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Only A Updated' })
    });
    // User B's business should be unaffected
    const getBAfterRes = await fetch(`${BASE}/business/profile`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const getBAfterData = await getBAfterRes.json();
    assert.strictEqual(getBAfterData.data.business.name, 'Profile Business B', 'Business B must remain unchanged');

    // ===========================
    // 6. Protected fields cannot be overwritten
    // ===========================
    const protectedRes = await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ _id: 'fakeid123', createdAt: '2020-01-01' })
    });
    // Strict mode should reject unknown fields
    assert.strictEqual(protectedRes.status, 400, 'Protected/unknown fields must be rejected by validation');

    // ===========================
    // 7. Validation rejects invalid data
    // ===========================
    const invalidRes = await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ gstin: 'INVALID' })
    });
    assert.strictEqual(invalidRes.status, 400, 'Invalid GSTIN should return 400');

    const invalidPanRes = await fetch(`${BASE}/business/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ pan: 'BAD' })
    });
    assert.strictEqual(invalidPanRes.status, 400, 'Invalid PAN should return 400');

    // ===========================
    // CLEANUP
    // ===========================
    const User = require('../src/models/User');
    const Business = require('../src/models/Business');
    await User.deleteMany({ email: { $in: [`profilea_${uid}@test.com`, `profileb_${uid}@test.com`] } });
    await Business.deleteMany({ _id: { $in: [businessAId, businessBId] } });

  } finally {
    server.close();
    await mongoose.disconnect();
  }
});
