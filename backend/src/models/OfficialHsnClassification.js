const mongoose = require('mongoose');

/**
 * BillFlow-Pro — Layer 1: Official HSN / SAC Classification Taxonomy
 * 
 * Represents pure tariff and service nomenclature derived from official Indian Government sources:
 * - WCO Harmonized System / First Schedule to Customs Tariff Act, 1975 (Goods Chapters 01–98)
 * - Scheme of Classification of Services (Notification No. 11/2017-CT(Rate), Chapter 99)
 * - GST Portal Master HSN Directory (gst.gov.in)
 * 
 * Invariants:
 * - Platform-wide, read-only to tenants.
 * - Leading zeros are strictly preserved (e.g., '0101', '0401', '9983').
 * - Code lengths are strictly validated by classification type:
 *   - HSN: 2, 4, 6, or 8 digits
 *   - SAC: 4 or 6 digits (always starting with '99')
 * - Contains zero tax rates (rates belong exclusively to Layer 2 GstRateRule).
 */
const officialHsnClassificationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Classification code is required'],
    trim: true,
    validate: {
      validator: function(v) {
        if (this.type === 'SAC') {
          return /^99\d{2}$|^99\d{4}$/.test(v);
        }
        if (this.type === 'HSN') {
          return /^\d{2}$|^\d{4}$|^\d{6}$|^\d{8}$/.test(v);
        }
        return true;
      },
      message: props => `Invalid code '${props.value}' for classification type`
    },
    index: true
  },
  type: {
    type: String,
    enum: ['HSN', 'SAC'],
    required: [true, 'Classification type is required'],
    index: true
  },
  digits: {
    type: Number,
    enum: [2, 4, 6, 8],
    required: [true, 'Digit length is required'],
    validate: {
      validator: function(v) {
        return this.code ? this.code.length === v : true;
      },
      message: props => `Digit length ${props.value} does not match code length`
    },
    index: true
  },
  chapter: {
    type: String,
    required: [true, 'Chapter is required'],
    trim: true,
    index: true
  },
  heading: {
    type: String,
    trim: true,
    index: true
  },
  legalDescription: {
    type: String,
    required: [true, 'Official legal description is required'],
    trim: true
  },
  tradeAliases: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  searchTokens: [{
    type: String,
    lowercase: true,
    index: true
  }],
  isSelectable: {
    type: Boolean,
    default: true
  },
  datasetVersion: {
    type: String,
    required: [true, 'Dataset version is required'],
    index: true
  },
  sourceDocument: {
    type: String,
    default: 'GST Portal Official Master HSN'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure a code of a given type is unique within a specific dataset release
officialHsnClassificationSchema.index(
  { code: 1, type: 1, datasetVersion: 1 },
  { unique: true }
);

// Full-text search index across legal descriptions and trade aliases
officialHsnClassificationSchema.index(
  { legalDescription: 'text', tradeAliases: 'text' }
);

module.exports = mongoose.model('OfficialHsnClassification', officialHsnClassificationSchema);
