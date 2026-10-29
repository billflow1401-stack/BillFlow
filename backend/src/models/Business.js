const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerName: { type: String, trim: true },
  tagline: { type: String, trim: true },
  address: { type: String, trim: true },
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
  phone: { type: String, trim: true },
  alternatePhone: { type: String, trim: true },
  email: { 
    type: String, 
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  website: { type: String, trim: true },
  logoUrl: { type: String },
  bankDetails: {
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { 
      type: String, 
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format']
    },
    branchName: { type: String, trim: true },
    accountName: { type: String, trim: true }
  },
  invoiceSettings: {
    prefix: { type: String, default: 'INV-', trim: true },
    defaultDueDays: { type: Number, default: 7 },
    notes: { type: String, trim: true }
  },
  signature: {
    url: { type: String, trim: true },
    signerName: { type: String, trim: true },
    designation: { type: String, trim: true, default: 'Authorized Signatory' }
  },
  seal: {
    url: { type: String, trim: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);
