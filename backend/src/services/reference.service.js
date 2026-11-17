const OfficialHsnClassification = require('../models/OfficialHsnClassification');
const GstRateRule = require('../models/GstRateRule');
const DatasetVersionConfig = require('../models/DatasetVersionConfig');
const TaxConfig = require('../models/TaxConfig');
const AppError = require('../utils/AppError');

/**
 * Search official Layer 1 classifications and attach Layer 2 candidate rate rules.
 */
const searchOfficialClassifications = async ({ q, type, digits, limit = 20 }) => {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  // Active dataset version
  const activeVersion = await DatasetVersionConfig.findOne({ status: 'PUBLISHED' }).sort({ publicationDate: -1 });
  const datasetVersion = activeVersion ? activeVersion.datasetVersion : 'GSTN-2026.11.1';

  const filter = { isActive: true };
  if (type) {
    filter.type = type.toUpperCase();
  }
  if (digits) {
    filter.digits = parseInt(digits, 10);
  }

  if (q && q.trim()) {
    const cleanQ = q.trim();
    const escapedQ = cleanQ.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    
    // If query starts with digits, prioritize code prefix match, else search description and trade aliases
    if (/^\d+/.test(cleanQ)) {
      filter.code = { $regex: `^${escapedQ}` };
    } else {
      filter.$or = [
        { description: { $regex: escapedQ, $options: 'i' } },
        { tradeAliases: { $regex: escapedQ, $options: 'i' } }
      ];
    }
  }

  const classifications = await OfficialHsnClassification.find(filter)
    .sort({ digits: 1, code: 1 })
    .limit(parsedLimit);

  const codes = classifications.map(c => c.code);

  // Fetch candidate rate rules for these codes
  const rules = codes.length > 0
    ? await GstRateRule.find({ hsnSacPattern: { $in: codes }, isActive: true }).sort({ hsnSacPattern: 1, ruleId: 1 })
    : [];

  const rulesMap = new Map();
  for (const rule of rules) {
    const key = `${rule.classificationType}:${rule.hsnSacPattern}`;
    if (!rulesMap.has(key)) {
      rulesMap.set(key, []);
    }
    rulesMap.get(key).push({
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      taxTreatment: rule.taxTreatment,
      gstRate: rule.gstRate,
      cgstRate: rule.cgstRate,
      sgstRate: rule.sgstRate,
      igstRate: rule.igstRate,
      compensationCess: rule.compensationCess,
      conditionType: rule.conditionType,
      conditionCriteria: rule.conditionCriteria,
      conditionDescription: rule.conditionDescription,
      isRcmApplicable: rule.isRcmApplicable,
      rcmSection: rule.rcmSection,
      isSection9_5Applicable: rule.isSection9_5Applicable,
      supplierItcEligibility: rule.supplierItcEligibility,
      notificationReference: rule.notificationReference,
      datasetVersion: rule.datasetVersion
    });
  }

  const results = classifications.map(c => {
    const key = `${c.type}:${c.code}`;
    const candidateRules = rulesMap.get(key) || [];
    return {
      _id: c._id,
      code: c.code,
      digits: c.digits,
      type: c.type,
      classificationType: c.type,
      description: c.description,
      chapter: c.chapter,
      heading: c.heading,
      subheading: c.subheading,
      tradeAliases: c.tradeAliases,
      rules: candidateRules,
      hasMultipleRules: candidateRules.length > 1
    };
  });

  return {
    results,
    total: results.length,
    datasetVersion
  };
};

/**
 * Get all active official statutory rules for a specific HSN/SAC code.
 */
const getOfficialRulesByCode = async (code, type) => {
  if (!code) throw new AppError('HSN/SAC code is required', 400);

  const filter = { hsnSacPattern: code.trim(), isActive: true };
  if (type) {
    filter.classificationType = type.toUpperCase();
  }

  const [classification, rules] = await Promise.all([
    OfficialHsnClassification.findOne({ code: code.trim(), ...(type ? { type: type.toUpperCase() } : {}) }),
    GstRateRule.find(filter).sort({ ruleId: 1 })
  ]);

  return {
    classification: classification ? {
      _id: classification._id,
      code: classification.code,
      digits: classification.digits,
      type: classification.type,
      classificationType: classification.type,
      description: classification.description,
      tradeAliases: classification.tradeAliases
    } : null,
    rules
  };
};

/**
 * Confirm a taxpayer's tax classification and statutory rule (Layer 3 TaxConfig).
 */
const confirmTaxSelection = async (businessId, userId, payload) => {
  const {
    classificationType,
    hsnSac,
    ruleId = 'MANUAL',
    description,
    isManualOverride = false,
    overrideReasonCategory = 'NONE',
    overrideReasonDetails,
    overrideGstRate,
    overrideTaxTreatment = 'TAXABLE'
  } = payload;

  if (!classificationType || !hsnSac) {
    throw new AppError('classificationType and hsnSac are required', 400);
  }

  let finalGstRate = 0;
  let finalTaxTreatment = 'TAXABLE';
  let finalRuleVersion = '1.0';
  let finalConditionType = 'STANDARD';
  let finalConditionDescription = null;
  let finalNotificationRef = null;
  let finalDatasetVersion = null;
  let isOfficial = false;

  if (isManualOverride) {
    if (!overrideReasonCategory || overrideReasonCategory === 'NONE') {
      throw new AppError('Override reason category is mandatory for manual overrides', 400);
    }
    if (!overrideReasonDetails || overrideReasonDetails.trim().length < 5) {
      throw new AppError('Detailed justification (min 5 characters) is required for manual overrides', 400);
    }
    if (overrideGstRate === undefined || overrideGstRate === null) {
      throw new AppError('overrideGstRate is required when overriding statutory rates', 400);
    }
    finalGstRate = Number(overrideGstRate);
    finalTaxTreatment = overrideTaxTreatment;
    isOfficial = true;
  } else if (ruleId && ruleId !== 'MANUAL') {
    // Official Statutory Rule Selection
    const statutoryRule = await GstRateRule.findOne({
      ruleId,
      hsnSacPattern: hsnSac,
      classificationType,
      isActive: true
    });

    if (!statutoryRule) {
      throw new AppError(`Official statutory rate rule ${ruleId} not found for ${classificationType} ${hsnSac}`, 404);
    }

    finalGstRate = statutoryRule.gstRate;
    finalTaxTreatment = statutoryRule.taxTreatment;
    finalRuleVersion = String(statutoryRule.ruleVersion || '1.0');
    finalConditionType = statutoryRule.conditionType;
    finalConditionDescription = statutoryRule.conditionDescription;
    finalNotificationRef = statutoryRule.notificationReference;
    finalDatasetVersion = statutoryRule.datasetVersion;
    isOfficial = true;
  } else {
    // Manual fallback
    finalGstRate = Number(overrideGstRate || 0);
    finalTaxTreatment = overrideTaxTreatment;
    isOfficial = false;
  }

  // Find or create Layer 3 TaxConfig
  const existingConfig = await TaxConfig.findOne({
    businessId,
    classificationType,
    hsnSac,
    ruleId: ruleId || 'MANUAL'
  });

  const auditEntry = {
    actorId: userId,
    action: isManualOverride ? 'MANUAL_OVERRIDE' : (existingConfig ? 'RULE_UPDATE' : 'OFFICIAL_SELECTION'),
    timestamp: new Date(),
    previousValues: existingConfig ? { gstRate: existingConfig.gstRate, ruleId: existingConfig.ruleId } : null,
    newValues: { gstRate: finalGstRate, ruleId: ruleId || 'MANUAL' },
    reasonText: isManualOverride
      ? `Manual override: [${overrideReasonCategory}] ${overrideReasonDetails}`
      : `Confirmed statutory rule ${ruleId} (${finalGstRate}%)`
  };

  if (existingConfig) {
    existingConfig.gstRate = finalGstRate;
    existingConfig.taxTreatment = finalTaxTreatment;
    existingConfig.ruleVersion = finalRuleVersion;
    existingConfig.conditionType = finalConditionType;
    existingConfig.conditionDescription = finalConditionDescription;
    existingConfig.notificationReference = finalNotificationRef;
    existingConfig.datasetVersion = finalDatasetVersion;
    existingConfig.isOfficialReference = isOfficial;
    existingConfig.isManualOverride = !!isManualOverride;
    existingConfig.overrideReasonCategory = isManualOverride ? overrideReasonCategory : 'NONE';
    existingConfig.overrideReasonDetails = isManualOverride ? overrideReasonDetails : null;
    if (description) existingConfig.description = description;
    existingConfig.auditTrail.push(auditEntry);
    await existingConfig.save();
    return existingConfig;
  }

  const newConfig = await TaxConfig.create({
    businessId,
    classificationType,
    hsnSac,
    ruleId: ruleId || 'MANUAL',
    ruleVersion: finalRuleVersion,
    description: description || `Confirmed ${classificationType} ${hsnSac}`,
    gstRate: finalGstRate,
    taxTreatment: finalTaxTreatment,
    conditionType: finalConditionType,
    conditionDescription: finalConditionDescription,
    notificationReference: finalNotificationRef,
    datasetVersion: finalDatasetVersion,
    isOfficialReference: isOfficial,
    isManualOverride: !!isManualOverride,
    overrideReasonCategory: isManualOverride ? overrideReasonCategory : 'NONE',
    overrideReasonDetails: isManualOverride ? overrideReasonDetails : null,
    auditTrail: [auditEntry],
    isActive: true
  });

  return newConfig;
};

module.exports = {
  searchOfficialClassifications,
  getOfficialRulesByCode,
  confirmTaxSelection
};
