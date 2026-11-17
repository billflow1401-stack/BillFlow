const mongoose = require('mongoose');

const taxConfigSchema = new mongoose.Schema({
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Business', 
    required: true,
    index: true
  },
  hsnSac: { type: String, required: true, trim: true },
  classificationType: { 
    type: String, 
    enum: ['HSN', 'SAC'], 
    required: true 
  },
  ruleId: {
    type: String,
    default: 'MANUAL',
    trim: true,
    index: true
  },
  ruleVersion: {
    type: String,
    default: null,
    trim: true
  },
  description: { type: String, trim: true },
  gstRate: { type: Number, required: true, min: 0, max: 100 },
  taxTreatment: {
    type: String,
    enum: ['TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST'],
    required: true,
    default: 'TAXABLE'
  },
  isOfficialReference: { type: Boolean, default: false },
  isManualOverride: { type: Boolean, default: false },
  overrideReasonCategory: {
    type: String,
    enum: ['NONE', 'ADVANCE_RULING', 'SPECIFIC_EXEMPTION', 'EXPORT_BOND', 'OTHER', null],
    default: null
  },
  overrideReasonDetails: { type: String, default: null, trim: true },
  conditionType: { type: String, default: null },
  conditionDescription: { type: String, default: null },
  notificationReference: { type: String, default: null },
  datasetVersion: { type: String, default: null },
  effectiveFrom: { type: Date, default: null },
  effectiveTo: { type: Date, default: null },
  sourceReference: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  auditTrail: [{
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: {
      type: String,
      enum: ['OFFICIAL_SELECTION', 'MANUAL_OVERRIDE', 'RULE_UPDATE', 'STATUS_CHANGE']
    },
    timestamp: { type: Date, default: Date.now },
    previousValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    reasonText: { type: String }
  }]
}, { timestamps: true });

// Prevent duplicate HSN/SAC configurations per business and rule
taxConfigSchema.index({ businessId: 1, classificationType: 1, hsnSac: 1, ruleId: 1 }, { unique: true });
// For lookup by description
taxConfigSchema.index({ businessId: 1, description: 'text' });

const TaxConfig = mongoose.model('TaxConfig', taxConfigSchema);

// Safe cleanup of legacy 3-field index without ruleId
TaxConfig.init().then(async () => {
  try {
    const idxs = await TaxConfig.collection.getIndexes();
    if (idxs && idxs['businessId_1_classificationType_1_hsnSac_1']) {
      await TaxConfig.collection.dropIndex('businessId_1_classificationType_1_hsnSac_1');
    }
  } catch (_) {}
}).catch(() => {});

module.exports = TaxConfig;
