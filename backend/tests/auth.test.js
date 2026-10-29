const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

// Apply optional DNS override for tests
if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TEST_PORT = 5002;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;

// Unique test email suffix to avoid collisions across test runs
const uid = Date.now();

test('Phase 4 — Authentication & Data Isolation', async (t) => {
  await mongoose.connect(env.mongoUri);
  const server = app.listen(TEST_PORT);

  try {
    // ===========================
    // REGISTRATION TESTS
    // ===========================

    // 1. Valid registration succeeds
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User A',
        email: `usera_${uid}@test.com`,
        password: 'password123',
        businessName: 'Business A'
      })
    });
    const regData = await regRes.json();
    assert.strictEqual(regRes.status, 201, 'Registration should return 201');
    assert.strictEqual(regData.success, true);
    assert.ok(regData.data.token, 'Token must be returned');
    assert.ok(regData.data.user._id, 'User ID must be returned');
    assert.ok(regData.data.business._id, 'Business ID must be returned');
    assert.strictEqual(regData.data.user.passwordHash, undefined, 'Password hash must NEVER be returned');

    const tokenA = regData.data.token;
    const businessAId = regData.data.business._id;

    // 2. Invalid input rejected
    const badRegRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad', password: '12' })
    });
    assert.strictEqual(badRegRes.status, 400, 'Invalid registration should return 400');

    // 3. Duplicate registration rejected
    const dupRegRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User A Dup',
        email: `usera_${uid}@test.com`,
        password: 'password123',
        businessName: 'Business A Dup'
      })
    });
    const dupRegData = await dupRegRes.json();
    assert.strictEqual(dupRegRes.status, 409, 'Duplicate email should return 409');

    // ===========================
    // LOGIN TESTS
    // ===========================

    // 4. Valid credentials succeed
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `usera_${uid}@test.com`,
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, 'Valid login should return 200');
    assert.ok(loginData.data.token, 'Token must be returned on login');
    assert.strictEqual(loginData.data.user.passwordHash, undefined, 'Password hash must not be in login response');

    // 5. Incorrect password rejected
    const badPwRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `usera_${uid}@test.com`,
        password: 'wrongpassword'
      })
    });
    assert.strictEqual(badPwRes.status, 401, 'Wrong password should return 401');

    // 6. Nonexistent user rejected safely (same error message)
    const noUserRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `nonexistent_${uid}@test.com`,
        password: 'password123'
      })
    });
    const noUserData = await noUserRes.json();
    assert.strictEqual(noUserRes.status, 401, 'Nonexistent user should return 401');
    assert.match(noUserData.message, /invalid email or password/i, 'Error message must be generic');

    // ===========================
    // AUTH MIDDLEWARE TESTS
    // ===========================

    // 7. Missing token rejected
    const noTokenRes = await fetch(`${BASE}/auth/me`);
    assert.strictEqual(noTokenRes.status, 401, 'Missing token should return 401');

    // 8. Invalid token rejected
    const badTokenRes = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: 'Bearer invalidtoken123' }
    });
    assert.strictEqual(badTokenRes.status, 401, 'Invalid token should return 401');

    // 9. Valid token accepted — GET /auth/me
    const meRes = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meData = await meRes.json();
    assert.strictEqual(meRes.status, 200, 'Valid token should return 200');
    assert.strictEqual(meData.data.user.email, `usera_${uid}@test.com`);
    assert.strictEqual(meData.data.user.passwordHash, undefined, 'Password hash must not be in /me response');

    // ===========================
    // DATA ISOLATION TESTS
    // ===========================

    // Register User B / Business B
    const regBRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User B',
        email: `userb_${uid}@test.com`,
        password: 'password456',
        businessName: 'Business B'
      })
    });
    const regBData = await regBRes.json();
    assert.strictEqual(regBRes.status, 201);
    const tokenB = regBData.data.token;
    const businessBId = regBData.data.business._id;

    // Verify businesses are different
    assert.notStrictEqual(businessAId, businessBId, 'Businesses must be distinct');

    // 10. User A /me returns only User A context
    const meARes = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meAData = await meARes.json();
    assert.strictEqual(meAData.data.user.name, 'User A');
    assert.strictEqual(meAData.data.business._id, businessAId);

    // 11. User B /me returns only User B context
    const meBRes = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const meBData = await meBRes.json();
    assert.strictEqual(meBData.data.user.name, 'User B');
    assert.strictEqual(meBData.data.business._id, businessBId);

    // 12. User A cannot see User B's identity
    assert.notStrictEqual(meAData.data.user._id, meBData.data.user._id, 'User IDs must differ');
    assert.notStrictEqual(meAData.data.business._id, meBData.data.business._id, 'Business IDs must differ');

    // ===========================
    // CLEANUP — remove test data from Atlas
    // ===========================
    const User = require('../src/models/User');
    const Business = require('../src/models/Business');
    await User.deleteMany({ email: { $in: [`usera_${uid}@test.com`, `userb_${uid}@test.com`] } });
    await Business.deleteMany({ _id: { $in: [businessAId, businessBId] } });

  } finally {
    server.close();
    await mongoose.disconnect();
  }
});
