const mongoose = require('mongoose');
const Money = require('../utils/money');
const { serializeMonetary } = require('../utils/serializer');

const itemSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['Product', 'Service'],
    required: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  sku: { type: String, trim: true },
  unit: { type: String, trim: true },
  hsnSac: { type: String, trim: true },
  unitPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Selling price is required'],
    get: v => Money.fromDecimal128(v, { isOptional: false }),
    set: v => Money.toDecimal128(v, { isOptional: false, fieldName: 'unitPrice' })
  },
  costPrice: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    get: v => Money.fromDecimal128(v, { isOptional: true }),
    set: v => Money.toDecimal128(v, { isOptional: true, fieldName: 'costPrice' })
  },
  gstRate: {
    type: Number,
    min: 0,
    default: null
    // Will be required by Phase 8 GST engine
  },
  taxType: {
    type: String,
    enum: ['Inclusive', 'Exclusive'],
    default: null
    // Will be required by Phase 8 GST engine
  },
  currentStock: {
    type: Number,
    default: null
  },
  lowStockThreshold: {
    type: Number,
    default: null
  },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { getters: true, transform: (doc, ret) => serializeMonetary(ret) },
  toObject: { getters: true }
});

// Enforce conditional logic for Services (No Inventory)
itemSchema.pre('save', function() {
  if (this.type === 'Service') {
    this.currentStock = null;
    this.lowStockThreshold = null;
    this.costPrice = null;
  }
});

itemSchema.index({ businessId: 1, type: 1 });
itemSchema.index({ businessId: 1, name: 1 });
// Business-scoped SKU uniqueness
itemSchema.index(
  { businessId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $exists: true, $type: "string" } } }
);

module.exports = mongoose.model('Item', itemSchema);
