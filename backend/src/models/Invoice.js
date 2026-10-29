const mongoose = require('mongoose');
const Money = require('../utils/money');
const { serializeMonetary } = require('../utils/serializer');

const decimalField = (fieldName, required = true, defaultValue = undefined) => {
  const config = {
    type: mongoose.Schema.Types.Decimal128,
    required: required ? [true, `${fieldName} is required`] : false,
    get: v => Money.fromDecimal128(v, { isOptional: !required }),
    set: v => Money.toDecimal128(v, { isOptional: !required, fieldName })
  };
  if (defaultValue !== undefined) {
    config.default = () => Money.toDecimal128(defaultValue, { fieldName });
  }
  return config;
};

const invoiceItemSnapshotSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  type: { type: String, enum: ['Product', 'Service'] },
  name: { type: String, required: true },
  description: { type: String },
  sku: { type: String },
  hsnSac: { type: String },
  classificationType: { type: String, enum: ['HSN', 'SAC'] },
  taxTreatment: { type: String, enum: ['TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST'] },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String },
  unitPrice: decimalField('unitPrice', true),
  pricingMode: { type: String, enum: ['INCLUSIVE', 'EXCLUSIVE'] },
  gstRate: { type: Number, required: true, min: 0 },
  cgstRate: { type: Number, default: 0, min: 0 },
  sgstRate: { type: Number, default: 0, min: 0 },
  igstRate: { type: Number, default: 0, min: 0 },
  discount: decimalField('discount', false, '0.00'),
  taxableValue: decimalField('taxableValue', true),
  cgst: decimalField('cgst', false, '0.00'),
  sgst: decimalField('sgst', false, '0.00'),
  igst: decimalField('igst', false, '0.00'),
  taxAmount: decimalField('taxAmount', true),
  lineTotal: decimalField('lineTotal', true)
}, { _id: false, toJSON: { getters: true }, toObject: { getters: true } });

const invoiceSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  invoiceNumber: { type: String, required: true },
  date: { type: Date, required: true },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ['Draft', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue'],
    default: 'Draft'
  },
  billingMode: {
    type: String,
    enum: ['General', 'GST-Registered'],
    default: function() {
      return (this.customerSnapshot && this.customerSnapshot.gstin) ? 'GST-Registered' : 'General';
    },
    index: true
  },
  placeOfSupply: { type: String, trim: true },
  placeOfSupplyStateCode: { type: String, trim: true },
  customerSnapshot: {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name: { type: String, required: true },
    customerType: { type: String, enum: ['Individual', 'Business'] },
    gstStatus: { type: String, enum: ['Registered', 'Unregistered'] },
    billingMode: { type: String, enum: ['General', 'GST-Registered'] },
    placeOfSupply: { type: String },
    placeOfSupplyStateCode: { type: String },
    gstin: { type: String },
    pan: { type: String },
    billingAddress: { type: String },
    city: { type: String },
    state: { type: String },
    pinCode: { type: String },
    country: { type: String },
    email: { type: String },
    phone: { type: String },
    showPhoneOnInvoice: { type: Boolean, default: false }
  },
  businessSnapshot: { // For historical locking of business identity
    name: { type: String, required: true },
    ownerName: { type: String },
    tagline: { type: String },
    gstin: { type: String },
    pan: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pinCode: { type: String },
    country: { type: String, default: 'India' },
    phone: { type: String },
    alternatePhone: { type: String },
    email: { type: String },
    website: { type: String },
    logoUrl: { type: String },
    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String },
      branchName: { type: String },
      accountName: { type: String }
    },
    signature: {
      url: { type: String },
      signerName: { type: String },
      designation: { type: String }
    },
    seal: {
      url: { type: String }
    }
  },
  items: [invoiceItemSnapshotSchema],
  summary: {
    subTotal: decimalField('subTotal', true),
    discountTotal: decimalField('discountTotal', false, '0.00'),
    taxableTotal: decimalField('taxableTotal', true),
    cgstTotal: decimalField('cgstTotal', false, '0.00'),
    sgstTotal: decimalField('sgstTotal', false, '0.00'),
    igstTotal: decimalField('igstTotal', false, '0.00'),
    taxTotal: decimalField('taxTotal', true),
    grandTotal: decimalField('grandTotal', true)
  },
  paymentStatus: {
    paidAmount: decimalField('paidAmount', false, '0.00'),
    balanceDue: decimalField('balanceDue', true),
    settlementDiscount: decimalField('settlementDiscount', false, '0.00'),
    isSettled: { type: Boolean, default: false },
    settlementNotes: { type: String }
  },
  digitalSignature: {
    isSigned: { type: Boolean, default: true },
    signedBy: { type: String },
    designation: { type: String, default: 'Authorized Signatory' },
    signedAt: { type: Date, default: Date.now },
    verificationCode: { type: String },
    documentHash: { type: String },
    auditId: { type: String }
  },
  auditTrail: [{
    action: { type: String, required: true },
    description: { type: String, required: true },
    performedBy: { type: String },
    timestamp: { type: Date, default: Date.now },
    documentHash: { type: String }
  }],
  showPhoneOnInvoice: { type: Boolean, default: false },
  notes: { type: String },
  terms: { type: String }
}, {
  timestamps: true,
  toJSON: { getters: true, transform: (doc, ret) => serializeMonetary(ret) },
  toObject: { getters: true }
});

// Ensure invoice numbers are unique per business, preventing exact duplicates
invoiceSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ businessId: 1, date: -1 });
invoiceSchema.index({ businessId: 1, status: 1 });
invoiceSchema.index({ businessId: 1, billingMode: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
