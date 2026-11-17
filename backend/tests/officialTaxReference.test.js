const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const env = require('../src/config/env');

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const OfficialHsnClassification = require('../src/models/OfficialHsnClassification');
const GstRateRule = require('../src/models/GstRateRule');
const DatasetVersionConfig = require('../src/models/DatasetVersionConfig');
const TaxConfig = require('../src/models/TaxConfig');
const { runIngestion, DATASET_VERSION } = require('../scripts/seed-official-tax-catalogue');

test('Phase 1: Official HSN/SAC Taxonomy & Rate-Rule Ingestion Suite', async (t) => {
  // Ensure database connection
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.mongoUri);
  }

  try {
    // Record initial tenant TaxConfig count to guarantee zero-mutation invariant
    const initialTaxConfigCount = await TaxConfig.countDocuments();

  await t.test('1. Ingestion Execution & Idempotency', async () => {
    // Run ingestion once
    const result1 = await runIngestion({ publish: true });
    assert.strictEqual(result1.datasetVersion, DATASET_VERSION);
    assert(result1.classificationCount > 0, 'Classifications should be ingested');
    assert(result1.rateRuleCount > 0, 'Rate rules should be ingested');

    // Run ingestion a second time to verify idempotency (zero duplicate key errors)
    const result2 = await runIngestion({ publish: true });
    assert.strictEqual(result2.datasetVersion, DATASET_VERSION);
    assert.strictEqual(result2.checksum, result1.checksum, 'Checksums should be deterministic and identical');

    // Verify DatasetVersionConfig record
    const versionDoc = await DatasetVersionConfig.findOne({ datasetVersion: DATASET_VERSION });
    assert(versionDoc, 'Version config document must exist');
    assert.strictEqual(versionDoc.status, 'PUBLISHED');
    assert.strictEqual(versionDoc.isDefaultActive, true);
    assert.strictEqual(versionDoc.checksumSha256, result1.checksum);
    assert.strictEqual(versionDoc.classificationRecordCount, result1.classificationCount);
    assert.strictEqual(versionDoc.rateRuleRecordCount, result1.rateRuleCount);
  });

  await t.test('2. Layer 1 Taxonomy: Validation, Leading Zeros & Structure', async () => {
    // Verify HSN code format and leading zeros
    const riceHeading = await OfficialHsnClassification.findOne({ code: '1006', datasetVersion: DATASET_VERSION });
    assert(riceHeading, 'HSN 1006 heading must exist');
    assert.strictEqual(riceHeading.type, 'HSN');
    assert.strictEqual(riceHeading.digits, 4);
    assert.strictEqual(riceHeading.chapter, '10');

    const basmatiRice = await OfficialHsnClassification.findOne({ code: '10063010', datasetVersion: DATASET_VERSION });
    assert(basmatiRice, 'HSN 10063010 must exist');
    assert.strictEqual(basmatiRice.digits, 8);
    assert.strictEqual(basmatiRice.chapter, '10');

    // Verify SAC code format (must start with 99 and have 4 or 6 digits)
    const hotelHeading = await OfficialHsnClassification.findOne({ code: '9963', datasetVersion: DATASET_VERSION });
    assert(hotelHeading, 'SAC 9963 heading must exist');
    assert.strictEqual(hotelHeading.type, 'SAC');
    assert.strictEqual(hotelHeading.digits, 4);
    assert.strictEqual(hotelHeading.chapter, '99');

    const itConsulting = await OfficialHsnClassification.findOne({ code: '998313', datasetVersion: DATASET_VERSION });
    assert(itConsulting, 'SAC 998313 subheading must exist');
    assert.strictEqual(itConsulting.type, 'SAC');
    assert.strictEqual(itConsulting.digits, 6);
    assert.strictEqual(itConsulting.chapter, '99');

    // Verify Schema Rejection: 5-digit HSN should be rejected by model validation on code
    const invalidHsn = new OfficialHsnClassification({
      code: '12345',
      type: 'HSN',
      digits: 4,
      chapter: '12',
      legalDescription: 'Invalid HSN',
      datasetVersion: 'TEST'
    });
    await assert.rejects(async () => {
      await invalidHsn.validate();
    }, /ValidationError:.*(code|digits)/);

    // Verify Schema Rejection: SAC code not starting with '99'
    const invalidSac = new OfficialHsnClassification({
      code: '8863',
      type: 'SAC',
      digits: 4,
      chapter: '88',
      legalDescription: 'Invalid SAC',
      datasetVersion: 'TEST'
    });
    await assert.rejects(async () => {
      await invalidSac.validate();
    }, /ValidationError:.*code/);
    assert.strictEqual(invalidSac.code.startsWith('99'), false, 'SAC must start with 99');
  });

  await t.test('3. Layer 2 Rate Rules: Mathematical Parity & Notifications', async () => {
    const allRules = await GstRateRule.find({ datasetVersion: DATASET_VERSION });
    assert(allRules.length >= 15, 'Must contain all core statutory rate rules');

    for (const rule of allRules) {
      // Test CGST + SGST === GST parity
      assert.strictEqual(
        rule.cgstRate + rule.sgstRate,
        rule.gstRate,
        `Rule ${rule.ruleId} fails intra-state split parity: ${rule.cgstRate} + ${rule.sgstRate} !== ${rule.gstRate}`
      );
      // Test IGST === GST parity
      assert.strictEqual(
        rule.igstRate,
        rule.gstRate,
        `Rule ${rule.ruleId} fails inter-state IGST parity: ${rule.igstRate} !== ${rule.gstRate}`
      );
      // Test statutory citation presence
      assert(rule.notificationReference && rule.notificationReference.length > 5, `Rule ${rule.ruleId} missing citation`);
      assert(rule.effectiveFrom instanceof Date, `Rule ${rule.ruleId} missing effectiveFrom`);
    }
  });

  await t.test('4. Statutory Slabs: Apparel (6109) & Footwear (6403/6404) Thresholds', async () => {
    // Apparel HSN 6109 must have two distinct rules with 2500 threshold
    const apparelLte = await GstRateRule.findOne({ ruleId: 'RULE-6109-SLAB-LTE2500', datasetVersion: DATASET_VERSION });
    const apparelGt = await GstRateRule.findOne({ ruleId: 'RULE-6109-SLAB-GT2500', datasetVersion: DATASET_VERSION });

    assert(apparelLte, 'Apparel LTE 2500 rule must exist');
    assert(apparelGt, 'Apparel GT 2500 rule must exist');

    assert.strictEqual(apparelLte.gstRate, 5);
    assert.strictEqual(apparelLte.conditionType, 'TRANSACTION_VALUE_SLAB');
    assert.strictEqual(apparelLte.conditionCriteria.operator, 'LTE');
    assert.strictEqual(apparelLte.conditionCriteria.thresholdValue, 2500);
    assert.strictEqual(apparelLte.conditionCriteria.unitBasis, 'PER_PIECE');
    assert(apparelLte.notificationReference.includes('09/2025'), 'Must cite Notif. 09/2025');

    assert.strictEqual(apparelGt.gstRate, 18);
    assert.strictEqual(apparelGt.conditionCriteria.operator, 'GT');
    assert.strictEqual(apparelGt.conditionCriteria.thresholdValue, 2500);
    assert.strictEqual(apparelGt.conditionCriteria.unitBasis, 'PER_PIECE');

    // Footwear HSN 6403/6404 must evaluate on PER_PAIR basis
    const footwearLte = await GstRateRule.findOne({ ruleId: 'RULE-6403-SLAB-LTE2500', datasetVersion: DATASET_VERSION });
    const footwearGt = await GstRateRule.findOne({ ruleId: 'RULE-6403-SLAB-GT2500', datasetVersion: DATASET_VERSION });

    assert(footwearLte && footwearGt, 'Footwear rules must exist');
    assert.strictEqual(footwearLte.gstRate, 5);
    assert.strictEqual(footwearLte.conditionCriteria.unitBasis, 'PER_PAIR');
    assert.strictEqual(footwearGt.gstRate, 18);
    assert.strictEqual(footwearGt.conditionCriteria.unitBasis, 'PER_PAIR');
  });

  await t.test('5. Statutory Conditions: Rice (1006) Packaging Distinction', async () => {
    const looseRice = await GstRateRule.findOne({ ruleId: 'RULE-1006-EXEMPT-LOOSE', datasetVersion: DATASET_VERSION });
    const packagedRice = await GstRateRule.findOne({ ruleId: 'RULE-1006-TAXABLE-PACKAGED', datasetVersion: DATASET_VERSION });

    assert(looseRice && packagedRice, 'Both rice rules must exist');
    assert.strictEqual(looseRice.gstRate, 0);
    assert.strictEqual(looseRice.taxTreatment, 'NIL_RATED');
    assert(looseRice.notificationReference.includes('10/2025'), 'Loose rice must cite Notif. 10/2025 (Exempt schedule)');

    assert.strictEqual(packagedRice.gstRate, 5);
    assert.strictEqual(packagedRice.taxTreatment, 'TAXABLE');
    assert(packagedRice.notificationReference.includes('09/2025'), 'Packaged rice must cite Notif. 09/2025');
  });

  await t.test('6. 2026 Targeted Amendments: Notif. 02/2026 (Fertiliser & Tyres)', async () => {
    // Notification 02/2026: Seaweed bio-stimulant fertiliser registered under FCO 1985 is 5%
    const bioFertiliser = await GstRateRule.findOne({ ruleId: 'RULE-3101-BIO-STIMULANT', datasetVersion: DATASET_VERSION });
    assert(bioFertiliser, 'Bio-stimulant fertiliser rule must exist');
    assert.strictEqual(bioFertiliser.gstRate, 5);
    assert.strictEqual(bioFertiliser.conditionType, 'REGISTERED_BIO_STIMULANT');
    assert(bioFertiliser.notificationReference.includes('02/2026'), 'Must cite Notif. 02/2026');

    // Notification 02/2026: Retreaded tractor tyres (40121910) is 5%
    const tractorTyre = await GstRateRule.findOne({ ruleId: 'RULE-4012-TRACTOR-TYRE', datasetVersion: DATASET_VERSION });
    assert(tractorTyre, 'Retreaded tractor tyre rule must exist');
    assert.strictEqual(tractorTyre.gstRate, 5);
    assert.strictEqual(tractorTyre.matchScope, 'EXACT_CODE');
    assert.strictEqual(tractorTyre.hsnSacPattern, '40121910');

    // Other retreaded tyres (4012) remain at 18%
    const otherTyre = await GstRateRule.findOne({ ruleId: 'RULE-4012-OTHER-TYRES', datasetVersion: DATASET_VERSION });
    assert(otherTyre, 'Other tyres rule must exist');
    assert.strictEqual(otherTyre.gstRate, 18);
  });

  await t.test('7. 2026 Services Amendments: Notif. 06/2026 & 08/2026', async () => {
    // Notification 06/2026: Same-line input service credit cap of 2.5%
    const transportRule = await GstRateRule.findOne({ ruleId: 'RULE-9965-TRANSPORT-SAME-LINE-ITC', datasetVersion: DATASET_VERSION });
    assert(transportRule, 'Same-line ITC transport rule must exist');
    assert.strictEqual(transportRule.supplierItcCondition.creditEligibility, 'SAME_LINE_OF_BUSINESS_ONLY');
    assert.strictEqual(transportRule.supplierItcCondition.rateBasedCreditCapPercentage, 2.5);
    assert.strictEqual(transportRule.supplierItcCondition.sameLineServiceScope.sacPattern, '9965');

    // Notification 08/2026: Passenger vehicle rental (fuel included) under RCM Section 9(3)
    const rcmRule = await GstRateRule.findOne({ ruleId: 'RULE-9966-RCM-NON-CORP', datasetVersion: DATASET_VERSION });
    assert(rcmRule, 'Vehicle rental RCM rule must exist');
    assert.strictEqual(rcmRule.taxCollectionMechanism, 'RECIPIENT_REVERSE_CHARGE_9_3');
    assert(rcmRule.notificationReference.includes('08/2026'), 'Must cite Notif. 08/2026');

    // Forward charge 18% option
    const fwdRule = await GstRateRule.findOne({ ruleId: 'RULE-9966-FORWARD-18PCT', datasetVersion: DATASET_VERSION });
    assert(fwdRule, 'Vehicle rental forward charge rule must exist');
    assert.strictEqual(fwdRule.taxCollectionMechanism, 'FORWARD_CHARGE');
    assert.strictEqual(fwdRule.gstRate, 18);
  });

  await t.test('8. Section 9(5) Delivery Services & Courier Exclusion (Notif. 09/2026)', async () => {
    // Delivery service under 9965 has taxCollectionMechanism: ECO_SECTION_9_5
    const ecoDeliveryRule = await GstRateRule.findOne({ ruleId: 'RULE-9965-DELIVERY-ECO-SEC9_5', datasetVersion: DATASET_VERSION });
    assert(ecoDeliveryRule, 'ECO delivery rule must exist');
    assert.strictEqual(ecoDeliveryRule.taxCollectionMechanism, 'ECO_SECTION_9_5');
    assert.strictEqual(ecoDeliveryRule.ecoDetails.serviceCategory, 'DELIVERY_UNREGISTERED_SUPPLIER');
    assert(ecoDeliveryRule.ecoDetails.conditionPrerequisite.includes('Section 22(1)'), 'Must enforce Sec 22(1) prerequisite');

    // Courier service under 9968 is strictly FORWARD_CHARGE (excluded from Section 9(5))
    const courierRule = await GstRateRule.findOne({ ruleId: 'RULE-9968-COURIER-FORWARD', datasetVersion: DATASET_VERSION });
    assert(courierRule, 'Courier rule must exist');
    assert.strictEqual(courierRule.taxCollectionMechanism, 'FORWARD_CHARGE');
    assert.notStrictEqual(courierRule.taxCollectionMechanism, 'ECO_SECTION_9_5');
  });

  await t.test('9. Zero-Mutation Invariant on Tenant Data', async () => {
    // Ensure that seeding global reference catalogues did NOT create, modify, or delete any tenant TaxConfig records
    const finalTaxConfigCount = await TaxConfig.countDocuments();
    assert.strictEqual(
      finalTaxConfigCount,
      initialTaxConfigCount,
      `Tenant TaxConfig count must remain exactly invariant (${initialTaxConfigCount})`
    );
  });
  } finally {
    await mongoose.disconnect();
  }
});
