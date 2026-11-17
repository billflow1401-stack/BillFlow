const mongoose = require('mongoose');

/**
 * BillFlow-Pro — Reference Dataset Version & Governance Config
 * 
 * Tracks the releases, SHA-256 checksums, statutory notifications covered,
 * and active production pointers for Layer 1 (Taxonomy) and Layer 2 (Rate Rules).
 */
const datasetVersionConfigSchema = new mongoose.Schema({
  datasetVersion: {
    type: String,
    required: [true, 'Dataset version is required'],
    unique: true,
    trim: true // e.g. "GSTN-2026.11.1"
  },
  releaseDate: {
    type: Date,
    required: [true, 'Release date is required']
  },
  sourceDocument: {
    type: String,
    required: true,
    default: 'GST Portal Official Master HSN'
  },
  notificationsCovered: [{
    type: String,
    trim: true
  }],
  classificationRecordCount: {
    type: Number,
    required: true,
    default: 0
  },
  rateRuleRecordCount: {
    type: Number,
    required: true,
    default: 0
  },
  checksumSha256: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'STAGING', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT',
    index: true
  },
  isDefaultActive: {
    type: Boolean,
    default: false,
    index: true
  },
  publishedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DatasetVersionConfig', datasetVersionConfigSchema);

