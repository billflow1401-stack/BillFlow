const Decimal = require('decimal.js');
const mongoose = require('mongoose');

// Configure global financial math precision and rounding
Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

const MONETARY_STRING_REGEX = /^\d+(\.\d{1,2})?$/;

class Money {
  /**
   * Validates and normalizes raw input to a canonical 2-decimal string ("1250.50").
   * Strictly rejects malformed data or excess precision (> 2 decimal places).
   */
  static parseInput(rawInput, { isOptional = false, fieldName = 'Amount' } = {}) {
    if (rawInput === null || rawInput === undefined || rawInput === '') {
      if (isOptional) return null;
      throw new Error(`${fieldName} is required`);
    }

    const str = String(rawInput).trim();

    if (!MONETARY_STRING_REGEX.test(str)) {
      throw new Error(`${fieldName} must be a valid non-negative monetary amount with at most 2 decimal places; received: '${str}'`);
    }

    const d = new Decimal(str);
    return d.toFixed(2);
  }

  /**
   * Converts any monetary input into Mongoose Decimal128.
   * Validates EVERY input, INCLUDING existing Decimal128 instances.
   */
  static toDecimal128(val, { isOptional = false, fieldName = 'Amount' } = {}) {
    if (val === null || val === undefined) {
      if (isOptional) return null;
      throw new Error(`${fieldName} is required`);
    }

    const rawStr = val instanceof mongoose.Types.Decimal128
      ? val.toString()
      : (typeof val === 'object' && val.$numberDecimal ? val.$numberDecimal : String(val).trim());

    if (!MONETARY_STRING_REGEX.test(rawStr)) {
      throw new Error(`INVALID_DECIMAL128_PRECISION: ${fieldName} Decimal128 value '${rawStr}' exceeds 2 decimal places or is malformed`);
    }

    const canonical = new Decimal(rawStr).toFixed(2);
    return mongoose.Types.Decimal128.fromString(canonical);
  }

  /**
   * Safely extracts a 2-decimal string from Decimal128, Decimal, or raw object.
   * Validates format without silent truncation.
   */
  static fromDecimal128(val, { isOptional = false } = {}) {
    if (val === null || val === undefined) {
      if (isOptional) return null;
      throw new Error('Monetary amount is missing');
    }

    const rawStr = val instanceof mongoose.Types.Decimal128
      ? val.toString()
      : (typeof val === 'object' && val.$numberDecimal ? val.$numberDecimal : String(val).trim());

    if (!MONETARY_STRING_REGEX.test(rawStr)) {
      throw new Error(`INVALID_STORED_MONEY: Persisted value '${rawStr}' violates monetary precision constraint`);
    }

    return new Decimal(rawStr).toFixed(2);
  }

  /**
   * Intentional rounding of calculated outputs (ROUND_HALF_UP to 2 decimal places).
   */
  static round(val) {
    if (val === null || val === undefined) return null;
    return new Decimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * Deterministic intra-state GST tax split with exact closure.
   */
  static splitGst(totalTaxAmount) {
    const total = this.round(totalTaxAmount);
    const cgst = total.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const sgst = total.minus(cgst);
    return {
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      totalTax: total.toFixed(2)
    };
  }
}

module.exports = Money;
