/**
 * BillFlow-Pro — Centralized GST Calculation Engine (Canonical Rupee Edition)
 *
 * Precision Policy:
 * All monetary calculations use decimal.js with ROUND_HALF_UP to 2 decimal places.
 * Intra-state component splits guarantee that CGST + SGST === TotalGST with exact odd-paise resolution.
 */

const Decimal = require('decimal.js');
const Money = require('../utils/money');
const AppError = require('../utils/AppError');
const {
  normalizeStateName,
  getStateCode,
  getStateCodeFromGstin
} = require('../utils/gstStateCodes');

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

const SUPPLY_TYPE = {
  INTRA_STATE: 'INTRA_STATE',
  INTER_STATE: 'INTER_STATE'
};

const PRICING_MODE = {
  EXCLUSIVE: 'EXCLUSIVE',
  INCLUSIVE: 'INCLUSIVE'
};

const TAX_TREATMENT = {
  TAXABLE: 'TAXABLE',
  NIL_RATED: 'NIL_RATED',
  EXEMPT: 'EXEMPT',
  NON_GST: 'NON_GST'
};

const validateInput = (input) => {
  const rawAmount = input.amount !== undefined ? input.amount : input.amountPaise;
  const { gstRate, pricingMode, supplyType, taxTreatment } = input;

  if (rawAmount === undefined || rawAmount === null) {
    throw new AppError('Amount is required', 400);
  }

  // Validate amount format without silent rounding
  try {
    Money.parseInput(rawAmount, { fieldName: 'Amount' });
  } catch (err) {
    throw new AppError(err.message, 400);
  }

  if (typeof gstRate !== 'number' || gstRate < 0 || gstRate > 100) {
    throw new AppError('gstRate must be a number between 0 and 100', 400);
  }

  if (!Object.values(PRICING_MODE).includes(pricingMode)) {
    throw new AppError(`pricingMode must be one of: ${Object.values(PRICING_MODE).join(', ')}`, 400);
  }

  if (!Object.values(SUPPLY_TYPE).includes(supplyType)) {
    throw new AppError(`supplyType must be one of: ${Object.values(SUPPLY_TYPE).join(', ')}`, 400);
  }

  if (taxTreatment && !Object.values(TAX_TREATMENT).includes(taxTreatment)) {
    throw new AppError(`taxTreatment must be one of: ${Object.values(TAX_TREATMENT).join(', ')}`, 400);
  }
};

const calculateGST = (input) => {
  validateInput(input);

  const rawAmount = input.amount !== undefined ? input.amount : input.amountPaise;
  const parsedAmountStr = Money.parseInput(rawAmount, { fieldName: 'Amount' });
  const amt = new Decimal(parsedAmountStr);
  const rate = new Decimal(input.gstRate || 0);
  const pricingMode = input.pricingMode;
  const supplyType = input.supplyType;
  const taxTreatment = input.taxTreatment || TAX_TREATMENT.TAXABLE;

  // Non-taxable treatments or 0% GST rate
  if (taxTreatment !== TAX_TREATMENT.TAXABLE || rate.isZero()) {
    const canonicalAmt = amt.toFixed(2);
    return {
      taxableAmount: canonicalAmt,
      cgst: '0.00',
      sgst: '0.00',
      igst: '0.00',
      totalGST: '0.00',
      total: canonicalAmt,
      gstRate: rate.toNumber(),
      effectiveGstRate: 0,
      pricingMode,
      supplyType,
      taxTreatment
    };
  }

  let taxableAmount;
  let totalGST;

  if (pricingMode === PRICING_MODE.EXCLUSIVE) {
    taxableAmount = amt;
    totalGST = Money.round(taxableAmount.times(rate).dividedBy(100));
  } else {
    // Inclusive: taxable = round(amount * 100 / (100 + gstRate))
    taxableAmount = Money.round(amt.times(100).dividedBy(new Decimal(100).plus(rate)));
    totalGST = Money.round(amt.minus(taxableAmount));
  }

  let cgst = '0.00';
  let sgst = '0.00';
  let igst = '0.00';

  if (supplyType === SUPPLY_TYPE.INTRA_STATE) {
    const split = Money.splitGst(totalGST);
    cgst = split.cgst;
    sgst = split.sgst;
  } else {
    igst = totalGST.toFixed(2);
  }

  const total = Money.round(taxableAmount.plus(totalGST));

  return {
    taxableAmount: taxableAmount.toFixed(2),
    cgst,
    sgst,
    igst,
    totalGST: totalGST.toFixed(2),
    total: total.toFixed(2),
    gstRate: rate.toNumber(),
    effectiveGstRate: rate.toNumber(),
    pricingMode,
    supplyType,
    taxTreatment
  };
};

/**
 * Authoritatively determines the Place of Supply (POS) and Supply Type (INTRA_STATE vs INTER_STATE)
 * according to Section 10 of the IGST Act, including Section 10(1)(ca) (Finance Act, 2023)
 * and GST Circular No. 209/3/2024-GST.
 *
 * @param {Object} params
 * @param {string} params.supplierState - Registered business state of supplier
 * @param {boolean} [params.isGstRegistered=false] - Whether recipient is GST registered
 * @param {string} [params.recipientState] - Recipient state recorded on invoice
 * @param {string} [params.deliveryState] - Delivery address state where goods terminate
 * @param {string} [params.gstin] - Recipient GSTIN if registered
 * @returns {Object} { placeOfSupply, placeOfSupplyStateCode, supplyType, isFallback, explanation }
 */
const determinePlaceOfSupply = (options = {}) => {
  const {
    deliveryState = null,
    placeOfSupply = null
  } = options;

  let isGstRegistered = options.isGstRegistered;
  let recipientState = options.recipientState;
  let gstin = options.gstin;

  if (options.customer) {
    if (isGstRegistered === undefined) {
      isGstRegistered = options.customer.gstStatus === 'Registered' || options.billingMode === 'GST-Registered';
    }
    if (!recipientState) {
      recipientState = options.customer.state;
    }
    if (!gstin) {
      gstin = options.customer.gstin;
    }
  }

  if (isGstRegistered === undefined && options.billingMode) {
    isGstRegistered = options.billingMode === 'GST-Registered';
  }

  const supplierStateInput = options.supplierState || 'Maharashtra';
  const canonicalSupplierState = normalizeStateName(supplierStateInput) || supplierStateInput.trim();
  const supplierStateCode = getStateCode(canonicalSupplierState);

  let posState = null;
  let isFallback = false;
  let explanation = '';

  // 1. If explicit delivery state is recorded (Section 10(1)(a) of IGST Act — goods movement terminates there)
  if (deliveryState && deliveryState.trim()) {
    posState = normalizeStateName(deliveryState) || deliveryState.trim();
    explanation = `Place of supply determined by delivery location: ${posState} (Section 10(1)(a) of IGST Act).`;
  }
  // 2. If explicit Place of Supply is specified for the transaction (e.g. over-the-counter handover Section 10(1)(c), or bill-to/ship-to)
  else if (placeOfSupply && placeOfSupply.trim()) {
    posState = normalizeStateName(placeOfSupply) || placeOfSupply.trim();
    explanation = `Place of supply explicitly specified for transaction: ${posState}.`;
  }
  // 3. Registered recipient default (Section 10(1)(a) supply involving movement to customer's registered place of business)
  else if (isGstRegistered) {
    if (gstin && getStateCodeFromGstin(gstin)) {
      const gstinCode = getStateCodeFromGstin(gstin);
      posState = normalizeStateName(gstinCode) || (recipientState && recipientState.trim()) || canonicalSupplierState;
      explanation = `Place of supply determined by recipient GSTIN registration: ${posState}.`;
    } else if (recipientState && recipientState.trim()) {
      posState = normalizeStateName(recipientState) || recipientState.trim();
      explanation = `Place of supply determined by registered recipient address: ${posState}.`;
    } else {
      posState = canonicalSupplierState;
      explanation = `Place of supply defaulted to supplier location: ${posState}.`;
    }
  }
  // 4. Unregistered recipient (General / Walk-in) under Section 10(1)(ca) & Circular 209/3/2024-GST
  else {
    if (recipientState && recipientState.trim()) {
      posState = normalizeStateName(recipientState) || recipientState.trim();
      explanation = `Place of supply determined by recorded recipient state: ${posState} (Section 10(1)(ca) of IGST Act).`;
    } else {
      // Statutory fallback: Section 10(1)(ca) of IGST Act
      posState = canonicalSupplierState;
      isFallback = true;
      explanation = `Statutory fallback under Section 10(1)(ca) of IGST Act: Supplier location (${canonicalSupplierState}) used because no recipient address/state was recorded.`;
    }
  }

  const posStateCode = getStateCode(posState);

  // Intra-state vs Inter-state supply decision
  let supplyType = SUPPLY_TYPE.INTRA_STATE;
  if (posStateCode && supplierStateCode) {
    supplyType = posStateCode === supplierStateCode ? SUPPLY_TYPE.INTRA_STATE : SUPPLY_TYPE.INTER_STATE;
  } else {
    supplyType = posState.toLowerCase().trim() === canonicalSupplierState.toLowerCase().trim()
      ? SUPPLY_TYPE.INTRA_STATE
      : SUPPLY_TYPE.INTER_STATE;
  }

  return {
    placeOfSupply: posState,
    placeOfSupplyStateCode: posStateCode,
    supplyType,
    isFallback,
    explanation
  };
};

const determineSupplyType = (sellerState, customerState) => {
  if (!sellerState || !customerState) {
    return SUPPLY_TYPE.INTRA_STATE;
  }
  const code1 = getStateCode(sellerState);
  const code2 = getStateCode(customerState);
  if (code1 && code2) {
    return code1 === code2 ? SUPPLY_TYPE.INTRA_STATE : SUPPLY_TYPE.INTER_STATE;
  }
  const normalize = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(sellerState) === normalize(customerState)
    ? SUPPLY_TYPE.INTRA_STATE
    : SUPPLY_TYPE.INTER_STATE;
};

/**
 * Evaluates GST Rule 46 recipient-information requirements for unregistered recipients.
 * Under Rule 46 (proviso), where taxable supply of goods to an unregistered recipient is ₹50,000 or more:
 * The invoice must contain recipient name, address, delivery address, state and state code.
 *
 * @param {Object} params
 * @param {string} [params.billingMode='General'] - 'General' | 'GST-Registered'
 * @param {Object} [params.customerSnapshot] - Snapshot of customer details
 * @param {string} [params.placeOfSupply] - Place of supply state name
 * @param {string} [params.placeOfSupplyStateCode] - Place of supply 2-digit code
 * @param {string|number|Decimal} params.taxableTotal - Total taxable supply value (excluding GST)
 * @returns {Object} { isApplicable, thresholdExceeded, compliant, missingFields, taxableTotal }
 */
const evaluateRule46Compliance = ({
  billingMode = 'General',
  customerSnapshot = {},
  placeOfSupply,
  placeOfSupplyStateCode,
  taxableTotal = 0
}) => {
  const isUnregistered = billingMode === 'General' || customerSnapshot?.gstStatus === 'Unregistered';
  const taxableDec = new Decimal(taxableTotal || 0);
  const thresholdExceeded = taxableDec.greaterThanOrEqualTo(50000);

  const missingFields = [];

  if (isUnregistered && thresholdExceeded) {
    const snap = customerSnapshot || {};
    const name = (snap.name || '').trim();
    const isGenericAnonymous = !name || name === 'Walk-in / Counter Sale' || name === 'Walk-in Customer';

    if (isGenericAnonymous) {
      missingFields.push('recipient name');
    }

    const address = (snap.billingAddress || snap.address || '').trim();
    if (!address) {
      missingFields.push('recipient address');
    }

    const state = (placeOfSupply || snap.state || '').trim();
    const stateCode = placeOfSupplyStateCode || getStateCode(state);
    if (!state || !stateCode) {
      missingFields.push('delivery state and state code');
    }
  }

  const compliant = missingFields.length === 0;

  return {
    isApplicable: isUnregistered,
    thresholdExceeded,
    compliant,
    missingFields,
    taxableTotal: taxableDec.toFixed(2)
  };
};

module.exports = {
  calculateGST,
  determinePlaceOfSupply,
  determineSupplyType,
  evaluateRule46Compliance,
  SUPPLY_TYPE,
  PRICING_MODE,
  TAX_TREATMENT
};
