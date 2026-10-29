const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');

// Apply optional DNS override for tests if needed
if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

// Override PORT for testing to avoid conflicts
const TEST_PORT = 5001;

test('API and Error Handling Foundation', async (t) => {
  // Connect to DB manually for the test
  await mongoose.connect(env.mongoUri);
  
  // Start server
  const server = app.listen(TEST_PORT);

  try {
    // 1. Test Health Endpoint
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
    assert.strictEqual(healthData.success, true, 'Health should report success');
    assert.strictEqual(healthData.database, 'Connected', 'Database should be Connected');

    // 2. Test Unknown Route
    const unknownRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/this-route-does-not-exist`);
    const unknownData = await unknownRes.json();
    assert.strictEqual(unknownRes.status, 404, 'Unknown route should return 404');
    assert.strictEqual(unknownData.success, false, 'Unknown route should report success: false');
    assert.match(unknownData.message, /Can't find/i, 'Message should indicate route not found');

    // 3. Test Malformed JSON
    const malformedRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/health`, {
      method: 'POST', // Just to send a body
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid_json": "missing_quotes}' // Syntax error
    });
    
    // Explicitly assert correct HTTP behavior for body-parser malformed JSON rejection
    assert.strictEqual(malformedRes.status, 400, 'Malformed JSON must rigorously return HTTP 400');
    const malformedData = await malformedRes.json();
    assert.strictEqual(malformedData.success, false, 'Malformed JSON must report success: false');
    
    // Express body-parser assigns status 400 to the error object which our centralized handler passes through, now mapped to AppError
    assert.strictEqual(malformedData.status, 'fail', 'Error status property should correctly map to fail from body-parser');
    assert.match(malformedData.message, /JSON/i, 'Error message must reflect a JSON parsing failure');

  } finally {
    // Cleanup
    server.close();
    await mongoose.disconnect();
  }
});
