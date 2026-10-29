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
  description: { type: String, trim: true },
  gstRate: { type: Number, required: true, min: 0, max: 100 },
  taxTreatment: {
    type: String,
    enum: ['TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST'],
    required: true,
    default: 'TAXABLE'
  },
  effectiveFrom: { type: Date, default: null },
  effectiveTo: { type: Date, default: null },
  sourceReference: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Prevent duplicate HSN/SAC configurations per business
taxConfigSchema.index({ businessId: 1, hsnSac: 1 }, { unique: true });
// For lookup by description
taxConfigSchema.index({ businessId: 1, description: 'text' });

module.exports = mongoose.model('TaxConfig', taxConfigSchema);
