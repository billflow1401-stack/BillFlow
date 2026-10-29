const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const MONETARY_FIELD_NAMES = new Set([
  'unitPrice', 'costPrice', 'amount', 'discount', 'taxableValue',
  'cgst', 'sgst', 'igst', 'taxAmount', 'lineTotal', 'subTotal',
  'discountTotal', 'taxableTotal', 'cgstTotal', 'sgstTotal', 'igstTotal',
  'taxTotal', 'grandTotal', 'paidAmount', 'balanceDue', 'salesTotal',
  'outstandingAmount', 'totalTax', 'paidThisMonth'
]);

const MONETARY_STRING_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Validates and serializes a monetary value to a canonical two-decimal string.
 * Rejects values with excess decimal places fail-closed.
 */
function serializeSingleMonetaryField(val, fieldName) {
  if (val === null || val === undefined) return null;

  let rawStr;
  if (val instanceof mongoose.Types.Decimal128) {
    rawStr = val.toString();
  } else if (typeof val === 'object' && val.$numberDecimal) {
    rawStr = val.$numberDecimal;
  } else if (typeof val === 'number') {
    rawStr = String(val);
  } else if (typeof val === 'string') {
    rawStr = val.trim();
  } else {
    throw new Error(`SERIALIZATION_ERROR: Field '${fieldName}' contains unrecognized monetary type: ${typeof val}`);
  }

  // Reject malformed input or excess decimal places
  if (!MONETARY_STRING_REGEX.test(rawStr)) {
    throw new Error(`SERIALIZATION_PRECISION_ERROR: Field '${fieldName}' value '${rawStr}' violates 2-decimal constraint`);
  }

  return new Decimal(rawStr).toFixed(2);
}

/**
 * Recursively normalizes response data.
 */
function serializeMonetary(data) {
  if (data === null || data === undefined) return data;

  if (data instanceof mongoose.Types.Decimal128 || (typeof data === 'object' && data.$numberDecimal)) {
    return serializeSingleMonetaryField(data, 'root');
  }

  if (data instanceof Date || data instanceof mongoose.Types.ObjectId) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeMonetary(item));
  }

  if (typeof data === 'object') {
    const plain = data.toObject ? data.toObject({ getters: true }) : data;
    const result = {};
    for (const [key, value] of Object.entries(plain)) {
      if (MONETARY_FIELD_NAMES.has(key)) {
        result[key] = serializeSingleMonetaryField(value, key);
      } else {
        result[key] = serializeMonetary(value);
      }
    }
    return result;
  }

  return data;
}

module.exports = { serializeMonetary, serializeSingleMonetaryField, MONETARY_FIELD_NAMES };
