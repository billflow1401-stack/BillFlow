const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Business', 
    required: true
  },
  sequenceValue: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

// Enforce one sequence counter per business
counterSchema.index({ businessId: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
