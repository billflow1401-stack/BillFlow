const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const Money = require('../src/utils/money');
const { serializeMonetary } = require('../src/utils/serializer');
const {
  resetAndSeed,
  validateTargetUri,
  dropCollectionsWithGuard,
  APPROVED_DROP_COLLECTIONS,
  CONFIRMATION_FLAG
} = require('../scripts/reset-and-seed-rupees');

// ---------------------------------------------------------------------------
// 1. Money.toDecimal128 — Strict precision and validation
// ---------------------------------------------------------------------------
test('Money.toDecimal128 — strictly validates every input including Decimal128', () => {
  // 1a. Rejects Decimal128 with excess precision (>2 decimals)
  const excessD128 = mongoose.Types.Decimal128.fromString('100.555');
  assert.throws(() => {
    Money.toDecimal128(excessD128);
  }, /exceeds 2 decimal places/);

  // 1b. Rejects negative Decimal128
  const negativeD128 = mongoose.Types.Decimal128.fromString('-50.00');
  assert.throws(() => {
    Money.toDecimal128(negativeD128);
  }, /exceeds 2 decimal places|malformed/);

  // 1c. Rejects string with excess precision
  assert.throws(() => {
    Money.toDecimal128('1250.555');
  }, /exceeds 2 decimal places/);

  // 1d. Rejects negative strings
  assert.throws(() => {
    Money.toDecimal128('-10.00');
  }, /exceeds 2 decimal places|malformed/);

  // 1e. Accepts valid Decimal128 and normalizes to 2-decimal Decimal128
  const validD128 = mongoose.Types.Decimal128.fromString('1250.50');
  const res1 = Money.toDecimal128(validD128);
  assert.ok(res1 instanceof mongoose.Types.Decimal128);
  assert.strictEqual(res1.toString(), '1250.50');

  // 1f. Accepts valid strings and normalizes to 2-decimal Decimal128
  const res2 = Money.toDecimal128('1250');
  assert.strictEqual(res2.toString(), '1250.00');

  const res3 = Money.toDecimal128('1250.5');
  assert.strictEqual(res3.toString(), '1250.50');

  const res4 = Money.toDecimal128('1250.50');
  assert.strictEqual(res4.toString(), '1250.50');

  // 1g. Nullability semantics
  assert.strictEqual(Money.toDecimal128(null, { isOptional: true }), null);
  assert.strictEqual(Money.toDecimal128(undefined, { isOptional: true }), null);
  assert.throws(() => {
    Money.toDecimal128(null, { isOptional: false });
  }, /is required/);
});

// ---------------------------------------------------------------------------
// 2. Money.parseInput — Canonical string normalization & strict parsing
// ---------------------------------------------------------------------------
test('Money.parseInput — normalizes valid rupee inputs and rejects malformed values', () => {
  // Normalization to canonical two-decimal string
  assert.strictEqual(Money.parseInput('1250'), '1250.00');
  assert.strictEqual(Money.parseInput('1250.5'), '1250.50');
  assert.strictEqual(Money.parseInput('1250.50'), '1250.50');
  assert.strictEqual(Money.parseInput('0'), '0.00');
  assert.strictEqual(Money.parseInput('0.05'), '0.05');

  // Rejection of invalid formats
  assert.throws(() => Money.parseInput('1e5'), /must be a valid non-negative monetary amount/);
  assert.throws(() => Money.parseInput('10.999'), /must be a valid non-negative monetary amount/);
  assert.throws(() => Money.parseInput('-50'), /must be a valid non-negative monetary amount/);
  assert.throws(() => Money.parseInput('abc'), /must be a valid non-negative monetary amount/);
  assert.throws(() => Money.parseInput(''), /is required/);

  // Optional handling
  assert.strictEqual(Money.parseInput('', { isOptional: true }), null);
  assert.strictEqual(Money.parseInput(null, { isOptional: true }), null);
});

// ---------------------------------------------------------------------------
// 3. Money.round & GST Split — Financial arithmetic rounding policy
// ---------------------------------------------------------------------------
test('Money.round — exact ROUND_HALF_UP rounding policy', () => {
  assert.strictEqual(Money.round('10.004').toFixed(2), '10.00');
  assert.strictEqual(Money.round('10.005').toFixed(2), '10.01');
  assert.strictEqual(Money.round('10.015').toFixed(2), '10.02');
  assert.strictEqual(Money.round('1250.555').toFixed(2), '1250.56');

  // GST 50/50 split deterministic rounding (odd paise handled without loss)
  const split = Money.splitGst('0.05');
  assert.strictEqual(split.cgst, '0.03');
  assert.strictEqual(split.sgst, '0.02');
  assert.strictEqual(
    new Decimal(split.cgst).plus(split.sgst).toFixed(2),
    '0.05'
  );
});

// ---------------------------------------------------------------------------
// 4. serializeMonetary — Serialization and fail-closed validation
// ---------------------------------------------------------------------------
test('serializeMonetary — fails closed on excess precision and normalizes valid values', () => {
  // Valid object serialization
  const input = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Consulting Service',
    gstRate: 18, // Non-monetary: remains numeric 18
    quantity: 2, // Non-monetary: remains numeric 2
    unitPrice: mongoose.Types.Decimal128.fromString('1500.50'),
    costPrice: null,
    nested: {
      lineTotal: mongoose.Types.Decimal128.fromString('3001.00')
    }
  };

  const serialized = serializeMonetary(input);
  assert.strictEqual(serialized.unitPrice, '1500.50');
  assert.strictEqual(serialized.costPrice, null);
  assert.strictEqual(serialized.nested.lineTotal, '3001.00');
  assert.strictEqual(serialized.gstRate, 18);
  assert.strictEqual(serialized.quantity, 2);

  // Fail-closed on excess decimal precision in monetary field
  const invalidDoc = {
    unitPrice: mongoose.Types.Decimal128.fromString('1500.555')
  };
  assert.throws(() => {
    serializeMonetary(invalidDoc);
  }, /SERIALIZATION_PRECISION_ERROR/);
});

// ---------------------------------------------------------------------------
// 5. reset-and-seed-rupees safety guards
// ---------------------------------------------------------------------------
test('reset-and-seed-rupees — URI validation enforces local dev/test allowlist', () => {
  // Allowed safe targets
  assert.strictEqual(validateTargetUri('mongodb://localhost:27017/billflow-dev'), true);
  assert.strictEqual(validateTargetUri('mongodb://127.0.0.1:27017/billflow_test'), true);
  assert.strictEqual(validateTargetUri('mongodb://localhost:27017/test-db'), true);

  // Disallowed remote hosts (including MongoDB Atlas cluster)
  assert.throws(() => {
    validateTargetUri('mongodb://prod-cluster.mongodb.net:27017/billflow-dev');
  }, /DISALLOWED_HOST/);

  assert.throws(() => {
    validateTargetUri('mongodb://cluster0.4zpufzf.mongodb.net:27017/billflow-dev');
  }, /DISALLOWED_HOST/);

  assert.throws(() => {
    validateTargetUri('mongodb+srv://cluster0.4zpufzf.mongodb.net/billflow-dev');
  }, /DISALLOWED_HOST/);

  assert.throws(() => {
    validateTargetUri('mongodb://192.168.1.50:27017/billflow-dev');
  }, /DISALLOWED_HOST/);

  // Disallowed database names (including BillFlowAudit)
  assert.throws(() => {
    validateTargetUri('mongodb://localhost:27017/production');
  }, /DISALLOWED_DATABASE/);

  assert.throws(() => {
    validateTargetUri('mongodb://localhost:27017/sales_records');
  }, /DISALLOWED_DATABASE/);

  assert.throws(() => {
    validateTargetUri('mongodb://localhost:27017/BillFlowAudit');
  }, /DISALLOWED_DATABASE/);

  // Missing database name
  assert.throws(() => {
    validateTargetUri('mongodb://localhost:27017/');
  }, /MISSING_DB_NAME/);
});

test('reset-and-seed-rupees — requires explicit confirmation flag before execution', async () => {
  // Invoking resetAndSeed without confirm: true and without CLI flag must reject
  await assert.rejects(async () => {
    await resetAndSeed({ confirm: false, uri: 'mongodb://localhost:27017/billflow-dev' });
  }, /CONFIRMATION_REQUIRED/);
});

test('reset-and-seed-rupees — approved collections list is strictly restricted to 6 collections', () => {
  const expectedApproved = ['items', 'invoices', 'payments', 'taxconfigs', 'stockmovements', 'counters'];
  assert.strictEqual(APPROVED_DROP_COLLECTIONS.length, 6);
  assert.deepStrictEqual([...APPROVED_DROP_COLLECTIONS].sort(), [...expectedApproved].sort());
  assert.ok(!APPROVED_DROP_COLLECTIONS.includes('businesses'), 'Must not include businesses');
  assert.ok(!APPROVED_DROP_COLLECTIONS.includes('users'), 'Must not include users');
  assert.ok(!APPROVED_DROP_COLLECTIONS.includes('customers'), 'Must not include customers');
});

test('reset-and-seed-rupees — rejects unauthorized collection drop', async () => {
  const mockDb = {
    collection: () => ({ drop: async () => {} })
  };

  // Attempting to drop unauthorized collections must throw UNAUTHORIZED_COLLECTION_DROP
  await assert.rejects(async () => {
    await dropCollectionsWithGuard(mockDb, ['businesses', 'items']);
  }, /UNAUTHORIZED_COLLECTION_DROP/);

  await assert.rejects(async () => {
    await dropCollectionsWithGuard(mockDb, ['users']);
  }, /UNAUTHORIZED_COLLECTION_DROP/);

  await assert.rejects(async () => {
    await dropCollectionsWithGuard(mockDb, ['customers']);
  }, /UNAUTHORIZED_COLLECTION_DROP/);
});

test('reset-and-seed-rupees — dropCollectionsWithGuard fails closed on drop errors other than code 26', async () => {
  // Mock DB where collection drop throws NamespaceNotFound (code 26)
  const mockDbNotFound = {
    collection: (name) => ({
      drop: async () => {
        const err = new Error('ns not found');
        err.code = 26;
        throw err;
      }
    })
  };

  // Should succeed silently (safe to ignore missing collections)
  await assert.doesNotReject(async () => {
    await dropCollectionsWithGuard(mockDbNotFound, ['items']);
  });

  // Mock DB where collection drop fails with permission or operational error (code 13)
  const mockDbAuthError = {
    collection: (name) => ({
      drop: async () => {
        const err = new Error('Unauthorized');
        err.code = 13;
        throw err;
      }
    })
  };

  // MUST abort immediately with COLLECTION_DROP_FAILURE
  await assert.rejects(async () => {
    await dropCollectionsWithGuard(mockDbAuthError, ['items']);
  }, {
    name: 'Error',
    code: 'COLLECTION_DROP_FAILURE'
  });
});
