const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  customerType: {
    type: String,
    enum: ['Individual', 'Business'],
    default: 'Business'
  },
  gstStatus: {
    type: String,
    enum: ['Registered', 'Unregistered'],
    default: function () {
      const isValidGstin = this.gstin && /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(this.gstin);
      return isValidGstin ? 'Registered' : 'Unregistered';
    }
  },
  isSystemWalkIn: {
    type: Boolean,
    default: false
  },
  normalizedPhone: {
    type: String,
    trim: true
  },
  phone: { type: String, trim: true },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  billingAddress: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pinCode: { type: String, trim: true },
  country: { type: String, trim: true, default: 'India' },
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN format']
  },
  pan: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{5}\d{4}[A-Z]{1}$/, 'Invalid PAN format']
  },
  notes: { type: String, trim: true }
}, { timestamps: true });

function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

const applyCustomerDefaults = function () {
  if (this.phone) {
    this.normalizedPhone = normalizePhoneNumber(this.phone);
  } else {
    this.normalizedPhone = undefined;
  }
  const isValidGstin = this.gstin && /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(this.gstin);
  if (!this.gstStatus) {
    this.gstStatus = isValidGstin ? 'Registered' : 'Unregistered';
  } else if (this.gstStatus === 'Unregistered' && isValidGstin && (!this.isModified || !this.isModified('gstStatus'))) {
    this.gstStatus = 'Registered';
  }
};

customerSchema.pre('validate', function () {
  applyCustomerDefaults.call(this);
});

customerSchema.pre('save', function () {
  applyCustomerDefaults.call(this);
});

// Customers must be unique by email/GSTIN per business (optional, but good for search)
customerSchema.index({ businessId: 1, email: 1 });
customerSchema.index({ businessId: 1, name: 1 });
customerSchema.index({ businessId: 1, gstStatus: 1 });
customerSchema.index({ businessId: 1, normalizedPhone: 1 });
customerSchema.index({ businessId: 1, isSystemWalkIn: 1 });

customerSchema.statics.normalizePhone = normalizePhoneNumber;

module.exports = mongoose.model('Customer', customerSchema);
