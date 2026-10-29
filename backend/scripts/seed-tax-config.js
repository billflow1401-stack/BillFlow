/**
 * BillFlow-Pro — Demo HSN/SAC Tax Configuration Seed Script
 * 
 * DISCLAIMER: These are DEMONSTRATION/REFERENCE records only.
 * They do NOT represent the complete or current legal GST classification
 * or rate universe. Do not rely on this data for actual tax filing.
 * 
 * Usage:
 *   node scripts/seed-tax-config.js <businessId>
 * 
 * The script is IDEMPOTENT — running it multiple times will not create
 * duplicate records. It uses upsert on { businessId, hsnSac } to ensure
 * each code exists exactly once per business.
 */

const mongoose = require('mongoose');
const path = require('path');

// Load env config
const env = require(path.join(__dirname, '..', 'src', 'config', 'env'));

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const TaxConfig = require(path.join(__dirname, '..', 'src', 'models', 'TaxConfig'));

/**
 * Small controlled demo dataset.
 * Covers HSN + SAC, multiple GST rates (0%, 5%, 12%, 18%, 28%),
 * and different tax treatments.
 */
const DEMO_TAX_CONFIGS = [
  // HSN — Goods
  {
    hsnSac: '84713010',
    classificationType: 'HSN',
    description: '[DEMO] Laptop computers',
    gstRate: 18,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '04011000',
    classificationType: 'HSN',
    description: '[DEMO] Fresh milk, not concentrated',
    gstRate: 0,
    taxTreatment: 'NIL_RATED',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '10063010',
    classificationType: 'HSN',
    description: '[DEMO] Basmati rice',
    gstRate: 5,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '39269099',
    classificationType: 'HSN',
    description: '[DEMO] Plastic articles, other',
    gstRate: 18,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '85287100',
    classificationType: 'HSN',
    description: '[DEMO] Television receivers',
    gstRate: 28,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '61091000',
    classificationType: 'HSN',
    description: '[DEMO] Cotton T-shirts',
    gstRate: 12,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },

  // SAC — Services
  {
    hsnSac: '998311',
    classificationType: 'SAC',
    description: '[DEMO] Management consulting services',
    gstRate: 18,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '997212',
    classificationType: 'SAC',
    description: '[DEMO] Rental of residential dwelling (exempt)',
    gstRate: 0,
    taxTreatment: 'EXEMPT',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '998314',
    classificationType: 'SAC',
    description: '[DEMO] IT consulting and support services',
    gstRate: 18,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  },
  {
    hsnSac: '996511',
    classificationType: 'SAC',
    description: '[DEMO] Goods transport by road',
    gstRate: 5,
    taxTreatment: 'TAXABLE',
    sourceReference: 'Demo reference data — not official',
    isActive: true
  }
];

/**
 * Seed demo tax configs for a specific business.
 * Uses upsert to be idempotent — safe to run multiple times.
 * 
 * @param {string} businessId - The target business ObjectId
 * @returns {Object} { created: number, updated: number, total: number }
 */
const seedTaxConfigs = async (businessId) => {
  let created = 0;
  let updated = 0;

  for (const config of DEMO_TAX_CONFIGS) {
    const result = await TaxConfig.updateOne(
      { businessId, hsnSac: config.hsnSac },
      { $set: { ...config, businessId } },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      created++;
    } else {
      // If it matched, we consider it updated (even if modifiedCount is 0 because data was same)
      updated++;
    }
  }

  return { created, updated, total: DEMO_TAX_CONFIGS.length };
};

// Export for programmatic use (tests)
module.exports = { seedTaxConfigs, DEMO_TAX_CONFIGS };

// CLI execution
if (require.main === module) {
  const businessId = process.argv[2];

  if (!businessId) {
    console.error('Usage: node scripts/seed-tax-config.js <businessId>');
    console.error('  businessId: The MongoDB ObjectId of the target business');
    process.exit(1);
  }

  if (!mongoose.Types.ObjectId.isValid(businessId)) {
    console.error('Error: Invalid ObjectId format');
    process.exit(1);
  }

  (async () => {
    try {
      await mongoose.connect(env.mongoUri);
      console.log('[Seed] Connected to MongoDB');

      const result = await seedTaxConfigs(businessId);
      console.log(`[Seed] Done: ${result.created} created, ${result.updated} updated, ${result.total} total demo records`);
      console.log('[Seed] DISCLAIMER: These are demo/reference records only — not official GST data.');

    } catch (err) {
      console.error('[Seed] Error:', err.message);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
    }
  })();
}
