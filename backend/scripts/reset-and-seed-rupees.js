/**
 * BillFlow-Pro — Database Reset & Canonical Rupee Seed Script
 * 
 * Safety Restrictions:
 * 1. Positive target allowlist: Only runs against localhost / 127.0.0.1 and permitted local dev/test DB names.
 * 2. Fail-closed drop error handling: Ignores ONLY confirmed NamespaceNotFound (code 26).
 *    Any other drop error aborts execution immediately before any seed operations run.
 * 3. Seed operations execute sequentially: runSeed() followed by seedTaxConfigs().
 */

const mongoose = require('mongoose');
const path = require('path');

const env = require(path.join(__dirname, '..', 'src', 'config', 'env'));
const { runSeed } = require(path.join(__dirname, 'seed-demo-data'));
const { seedTaxConfigs } = require(path.join(__dirname, 'seed-tax-config'));

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];
const ALLOWED_DB_PATTERNS = [
  /^billflow[-_]?(dev|development|test|local)?$/i,
  /^test[-_]?.*$/i
];

const APPROVED_DROP_COLLECTIONS = [
  'items',
  'invoices',
  'payments',
  'taxconfigs',
  'stockmovements',
  'counters'
];

const CONFIRMATION_FLAG = '--confirm-reset-dummy-data';

/**
 * Validates that the target MongoDB URI matches the local safety allowlist.
 * @param {string} uri 
 * @returns {boolean}
 */
function validateTargetUri(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('INVALID_TARGET: Target MongoDB URI is missing or invalid.');
  }

  // Parse connection URI
  let parsed;
  try {
    parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
  } catch {
    throw new Error('INVALID_TARGET: Malformed MongoDB connection URI.');
  }

  const hostname = parsed.hostname;
  if (!ALLOWED_HOSTS.includes(hostname)) {
    throw new Error(`DISALLOWED_HOST: Database host "${hostname}" is not in the local safety allowlist.`);
  }

  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (!dbName) {
    throw new Error('MISSING_DB_NAME: MongoDB URI must specify a target database name.');
  }

  const isAllowedDb = ALLOWED_DB_PATTERNS.some(pattern => pattern.test(dbName));
  if (!isAllowedDb) {
    throw new Error(`DISALLOWED_DATABASE: Database "${dbName}" does not match permitted local dev/test patterns.`);
  }

  return true;
}

/**
 * Drops collections with fail-closed error handling.
 * Only permits dropping collections in APPROVED_DROP_COLLECTIONS.
 * Ignores ONLY confirmed NamespaceNotFound. Any other error throws COLLECTION_DROP_FAILURE.
 * @param {mongoose.mongo.Db} db 
 * @param {string[]} [targetCollections]
 */
async function dropCollectionsWithGuard(db, targetCollections) {
  const collections = targetCollections || APPROVED_DROP_COLLECTIONS;

  // Guard against dropping unauthorized collections
  for (const collName of collections) {
    if (!APPROVED_DROP_COLLECTIONS.includes(collName)) {
      throw new Error(`UNAUTHORIZED_COLLECTION_DROP: Dropping collection "${collName}" is not permitted.`);
    }
  }

  for (const collName of collections) {
    try {
      await db.collection(collName).drop();
      console.log(`  Dropped collection: ${collName}`);
    } catch (err) {
      const isNamespaceNotFound =
        err.code === 26 ||
        err.codeName === 'NamespaceNotFound' ||
        (err.message && err.message.toLowerCase().includes('ns not found'));

      if (isNamespaceNotFound) {
        // Safe to ignore: collection does not exist
        continue;
      }

      // Any other error MUST abort execution immediately
      const dropError = new Error(`COLLECTION_DROP_FAILURE: Failed to drop collection "${collName}": ${err.message}`);
      dropError.code = 'COLLECTION_DROP_FAILURE';
      dropError.collection = collName;
      dropError.originalError = err;
      throw dropError;
    }
  }
}

/**
 * Execute full reset and canonical rupee seed.
 * @param {Object} options
 * @param {boolean} [options.preserveConnection=false]
 * @param {string} [options.uri]
 * @param {boolean} [options.confirm=false]
 */
async function resetAndSeed({ preserveConnection = false, uri = env.mongoUri, confirm = false } = {}) {
  // Enforce mandatory confirmation flag
  const hasCliFlag = process.argv.includes(CONFIRMATION_FLAG);
  if (!confirm && !hasCliFlag) {
    throw new Error(`CONFIRMATION_REQUIRED: Database reset aborted. Must supply "${CONFIRMATION_FLAG}" to confirm.`);
  }

  // 1. Safety validation
  validateTargetUri(uri);

  let didConnect = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(uri);
      didConnect = true;
      console.log(`Connected to safe database target: ${uri}`);
    }

    const db = mongoose.connection.db;

    // 2. Drop existing collections with fail-closed error handling
    console.log('Dropping existing database collections...');
    await dropCollectionsWithGuard(db);
    console.log('Database collections cleared successfully.');

    // 3. Run Demo Data Seed (Rupee amounts)
    console.log('Seeding demo rupee data (business, user, customers, items)...');
    const seedResult = await runSeed({ preserveConnection: true });
    console.log('Demo data seeded successfully.');

    // 4. Run Tax Config Seed
    console.log('Seeding demo HSN/SAC tax configurations...');
    const taxResult = await seedTaxConfigs(seedResult.business._id);
    console.log(`Tax configurations seeded (${taxResult.total} records).`);

    // 5. Verification checks
    const Item = mongoose.model('Item');
    const seededItems = await Item.find({ businessId: seedResult.business._id });
    if (seededItems.length === 0) {
      throw new Error('VERIFICATION_FAILURE: No items found after seed.');
    }

    console.log('\nReset and seed completed successfully with canonical rupees.');
    return {
      success: true,
      business: seedResult.business,
      user: seedResult.user,
      itemsCount: seededItems.length,
      taxConfigsCount: taxResult.total
    };
  } catch (err) {
    console.error('Reset and seed aborted due to error:', err.message);
    throw err;
  } finally {
    if (!preserveConnection && didConnect) {
      await mongoose.connection.close();
    }
  }
}

module.exports = {
  resetAndSeed,
  validateTargetUri,
  dropCollectionsWithGuard,
  ALLOWED_HOSTS,
  ALLOWED_DB_PATTERNS,
  APPROVED_DROP_COLLECTIONS,
  CONFIRMATION_FLAG
};

if (require.main === module) {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    console.error(`CONFIRMATION_REQUIRED: Database reset aborted. Must supply "${CONFIRMATION_FLAG}" to confirm.`);
    process.exit(1);
  }
  resetAndSeed({ confirm: true }).catch(() => {
    process.exit(1);
  });
}
