const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Business', 
    required: true,
    index: true
  },
  itemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Item', 
    required: true,
    index: true
  },
  movementType: { 
    type: String, 
    enum: ['IN', 'OUT', 'ADJUSTMENT'],
    required: true
  },
  quantity: { 
    type: Number, 
    required: true 
  },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  referenceType: { 
    type: String, 
    enum: ['Invoice', 'Manual'],
    required: true
  },
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId
  },
  // Stable line index within an invoice to distinguish same-product on multiple lines
  invoiceLineIndex: {
    type: Number
  },
  note: { type: String, trim: true }
}, { timestamps: true });

// Prevent duplicate OUT movements for the same invoice line item.
// The invoiceLineIndex distinguishes same-product on multiple invoice lines.
// Sparse: only enforced when referenceId and invoiceLineIndex are present (Invoice-type movements).
stockMovementSchema.index(
  { businessId: 1, referenceType: 1, referenceId: 1, itemId: 1, invoiceLineIndex: 1 },
  { unique: true, partialFilterExpression: { referenceType: 'Invoice' } }
);

// Efficient movement history queries
stockMovementSchema.index({ businessId: 1, itemId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
