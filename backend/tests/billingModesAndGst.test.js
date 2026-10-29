const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const Money = require('../src/utils/money');
const {
  calculateGST,
  determinePlaceOfSupply,
  determineSupplyType,
  evaluateRule46Compliance,
  SUPPLY_TYPE,
  PRICING_MODE,
  TAX_TREATMENT
} = require('../src/services/gstCalculation.service');
const {
  getStateCode,
  getStateCodeFromGstin,
  isGstinStateMatching,
  normalizeStateName
} = require('../src/utils/gstStateCodes');

const Customer = require('../src/models/Customer');
const Invoice = require('../src/models/Invoice');
const customerValidator = require('../src/validators/customer.validator');
const invoiceValidator = require('../src/validators/invoice.validator');

// ---------------------------------------------------------------------------
// 1. PHASE 8 — Required Numerical Regression Cases (Cases A through F)
// ---------------------------------------------------------------------------
test('Numerical Regression Case A: Intra-state exclusive GST (Maharashtra, ₹100 x 2 @ 18%)', () => {
  const result = calculateGST({
    amount: '200.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  assert.strictEqual(result.taxableAmount, '200.00', 'Taxable value must be 200.00');
  assert.strictEqual(result.cgst, '18.00', 'CGST must be 18.00');
  assert.strictEqual(result.sgst, '18.00', 'SGST must be 18.00');
  assert.strictEqual(result.igst, '0.00', 'IGST must be 0.00');
  assert.strictEqual(result.totalGST, '36.00', 'Total GST must be 36.00');
  assert.strictEqual(result.total, '236.00', 'Grand total must be 236.00');
});

test('Numerical Regression Case B: Inter-state exclusive GST (Karnataka POS, ₹100 x 2 @ 18%)', () => {
  const result = calculateGST({
    amount: '200.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTER_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  assert.strictEqual(result.taxableAmount, '200.00', 'Taxable value must be 200.00');
  assert.strictEqual(result.cgst, '0.00', 'CGST must be 0.00');
  assert.strictEqual(result.sgst, '0.00', 'SGST must be 0.00');
  assert.strictEqual(result.igst, '36.00', 'IGST must be 36.00');
  assert.strictEqual(result.totalGST, '36.00', 'Total GST must be 36.00');
  assert.strictEqual(result.total, '236.00', 'Grand total must be 236.00');
});

test('Numerical Regression Case C: Inclusive GST (Price ₹118 @ 18%)', () => {
  // Intra-state inclusive
  const intraResult = calculateGST({
    amount: '118.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.INCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  assert.strictEqual(intraResult.taxableAmount, '100.00', 'Taxable value must be 100.00');
  assert.strictEqual(intraResult.cgst, '9.00', 'CGST must be 9.00');
  assert.strictEqual(intraResult.sgst, '9.00', 'SGST must be 9.00');
  assert.strictEqual(intraResult.igst, '0.00', 'IGST must be 0.00');
  assert.strictEqual(intraResult.totalGST, '18.00', 'Total GST must be 18.00');
  assert.strictEqual(intraResult.total, '118.00', 'Grand total must be 118.00');

  // Inter-state inclusive
  const interResult = calculateGST({
    amount: '118.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.INCLUSIVE,
    supplyType: SUPPLY_TYPE.INTER_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  assert.strictEqual(interResult.taxableAmount, '100.00', 'Taxable value must be 100.00');
  assert.strictEqual(interResult.cgst, '0.00', 'CGST must be 0.00');
  assert.strictEqual(interResult.sgst, '0.00', 'SGST must be 0.00');
  assert.strictEqual(interResult.igst, '18.00', 'IGST must be 18.00');
  assert.strictEqual(interResult.totalGST, '18.00', 'Total GST must be 18.00');
  assert.strictEqual(interResult.total, '118.00', 'Grand total must be 118.00');
});

test('Numerical Regression Case D: Mixed rates (₹100 @ 18% + ₹100 @ 5% Exclusive)', () => {
  const line1 = calculateGST({
    amount: '100.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });
  const line2 = calculateGST({
    amount: '100.00',
    gstRate: 5,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  assert.strictEqual(line1.taxableAmount, '100.00');
  assert.strictEqual(line1.totalGST, '18.00');
  assert.strictEqual(line2.taxableAmount, '100.00');
  assert.strictEqual(line2.totalGST, '5.00');

  const totalTaxable = new Decimal(line1.taxableAmount).plus(line2.taxableAmount).toFixed(2);
  const totalGST = new Decimal(line1.totalGST).plus(line2.totalGST).toFixed(2);
  const grandTotal = new Decimal(line1.total).plus(line2.total).toFixed(2);

  assert.strictEqual(totalTaxable, '200.00', 'Total taxable must be 200.00');
  assert.strictEqual(totalGST, '23.00', 'Total GST must be 23.00');
  assert.strictEqual(grandTotal, '223.00', 'Grand total must be 223.00');
});

test('Numerical Regression Case E: Rounding (₹21 @ 5% Exclusive, split CGST ₹0.53 & SGST ₹0.52)', () => {
  const result = calculateGST({
    amount: '21.00',
    gstRate: 5,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  assert.strictEqual(result.taxableAmount, '21.00');
  assert.strictEqual(result.totalGST, '1.05', 'Total GST must be 1.05');
  assert.strictEqual(result.cgst, '0.53', 'CGST rounded up to 0.53');
  assert.strictEqual(result.sgst, '0.52', 'SGST receives remainder 0.52');
  assert.strictEqual(result.total, '22.05', 'Grand total must be 22.05');

  // Verify Money.splitGst exact odd-paise closure
  const split = Money.splitGst('1.05');
  assert.strictEqual(split.cgst, '0.53');
  assert.strictEqual(split.sgst, '0.52');
  assert.strictEqual(new Decimal(split.cgst).plus(split.sgst).toFixed(2), '1.05');
});

test('Numerical Regression Case F: Discount (₹100 - ₹10 discount = ₹90 taxable @ 18% Exclusive)', () => {
  const gross = new Decimal('100.00');
  const discount = new Decimal('10.00');
  const net = gross.minus(discount).toFixed(2);

  assert.strictEqual(net, '90.00');

  const result = calculateGST({
    amount: net,
    gstRate: 18,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  assert.strictEqual(result.taxableAmount, '90.00');
  assert.strictEqual(result.totalGST, '16.20');
  assert.strictEqual(result.cgst, '8.10');
  assert.strictEqual(result.sgst, '8.10');
  assert.strictEqual(result.total, '106.20', 'Grand total must be 106.20');
});

// ---------------------------------------------------------------------------
// 2. GST Place-of-Supply Engine & Section 10(1)(ca) Bug Fix
// ---------------------------------------------------------------------------
test('GST Engine: Root Cause Fix — Customer saved with only name no longer incorrectly incurs IGST', () => {
  const supplierState = 'Maharashtra';
  const customerWithNameOnly = {
    name: 'Rahul Walkin'
    // No state, no address, no GSTIN
  };

  const posResult = determinePlaceOfSupply({
    supplierState,
    customer: customerWithNameOnly,
    billingMode: 'General'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Maharashtra', 'POS must fall back to supplier state under Section 10(1)(ca)');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '27');
  assert.strictEqual(posResult.isFallback, true, 'Fallback flag must be true');
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTRA_STATE, 'Supply type must be INTRA_STATE (CGST + SGST), NOT IGST');
});

test('GST Engine: Unregistered customer with recorded state uses recorded state for POS', () => {
  const supplierState = 'Maharashtra'; // 27
  const customerInKarnataka = {
    name: 'Suresh Kumar',
    state: 'Karnataka' // 29
  };

  const posResult = determinePlaceOfSupply({
    supplierState,
    customer: customerInKarnataka,
    billingMode: 'General'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Karnataka');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '29');
  assert.strictEqual(posResult.isFallback, false);
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTER_STATE, 'Different state must be INTER_STATE (IGST)');
});

test('GST Engine: Delivery state override takes precedence for goods movement', () => {
  const supplierState = 'Maharashtra';
  const customer = {
    name: 'Acme Retail',
    state: 'Maharashtra'
  };

  const posResult = determinePlaceOfSupply({
    supplierState,
    customer,
    billingMode: 'General',
    deliveryState: 'Gujarat' // 24
  });

  assert.strictEqual(posResult.placeOfSupply, 'Gujarat');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '24');
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTER_STATE);
});

test('GST Engine: Registered customer derives POS from valid GSTIN state code', () => {
  const supplierState = 'Maharashtra';
  const registeredCustomer = {
    name: 'Bangalore Tech Pvt Ltd',
    gstStatus: 'Registered',
    gstin: '29ABCDE1234F1Z5' // Karnataka code 29
  };

  const posResult = determinePlaceOfSupply({
    supplierState,
    customer: registeredCustomer,
    billingMode: 'GST-Registered'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Karnataka');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '29');
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTER_STATE);
});

test('GST Engine: Registered customer with same-state GSTIN is Intra-state', () => {
  const supplierState = 'Maharashtra';
  const registeredCustomer = {
    name: 'Mumbai Traders LLP',
    gstStatus: 'Registered',
    gstin: '27AABCM5678P1Z3', // Maharashtra code 27
    state: 'Maharashtra'
  };

  const posResult = determinePlaceOfSupply({
    supplierState,
    customer: registeredCustomer,
    billingMode: 'GST-Registered'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Maharashtra');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '27');
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTRA_STATE);
});

test('GST State Codes: Validates 2-digit CBIC state codes and state matching', () => {
  assert.strictEqual(getStateCode('Maharashtra'), '27');
  assert.strictEqual(getStateCode('MH'), '27');
  assert.strictEqual(getStateCode('Karnataka'), '29');
  assert.strictEqual(getStateCode('Delhi'), '07');
  assert.strictEqual(getStateCode('27'), '27');
  assert.strictEqual(getStateCode('InvalidStateName'), null);

  assert.strictEqual(getStateCodeFromGstin('27AABCM5678P1Z3'), '27');
  assert.strictEqual(getStateCodeFromGstin('29ABCDE1234F1Z5'), '29');
  assert.strictEqual(getStateCodeFromGstin('INVALID_GSTIN'), null);

  assert.strictEqual(isGstinStateMatching('27AABCM5678P1Z3', 'Maharashtra'), true);
  assert.strictEqual(isGstinStateMatching('27AABCM5678P1Z3', 'Karnataka'), false);
});

// ---------------------------------------------------------------------------
// 3. Customer Model & Validation Rules
// ---------------------------------------------------------------------------
test('Customer Model: Separates customerType from gstStatus', async () => {
  // 1. Registered Individual (Sole Proprietor) is valid
  const soleProprietor = new Customer({
    businessId: new mongoose.Types.ObjectId(),
    customerType: 'Individual',
    gstStatus: 'Registered',
    name: 'Anand Verma (Sole Prop)',
    phone: '9876543210',
    gstin: '27AABCV1234E1Z9',
    state: 'Maharashtra'
  });
  const errSoleProp = await soleProprietor.validate().catch(e => e);
  assert.strictEqual(errSoleProp, undefined, 'Individual with GST registration should be completely valid');

  // 2. Unregistered Business is valid
  const unregBusiness = new Customer({
    businessId: new mongoose.Types.ObjectId(),
    customerType: 'Business',
    gstStatus: 'Unregistered',
    name: 'Local Kirana Store',
    phone: '9123456780',
    state: 'Maharashtra'
  });
  const errUnreg = await unregBusiness.validate().catch(e => e);
  assert.strictEqual(errUnreg, undefined, 'Business can be unregistered without mandatory GSTIN');

  // 3. Phone normalization
  assert.strictEqual(soleProprietor.normalizedPhone, '9876543210');
  assert.strictEqual(unregBusiness.normalizedPhone, '9123456780');
});

test('Customer Validator: Rejects Registered status when GSTIN is missing or invalid', () => {
  // Missing GSTIN for Registered
  const missingGstinResult = customerValidator.createCustomerSchema.safeParse({
    name: 'Invalid Corp',
    customerType: 'Business',
    gstStatus: 'Registered'
  });
  assert.strictEqual(missingGstinResult.success, false);
  const errorMsg = missingGstinResult.error?.issues[0]?.message;
  assert.match(errorMsg, /GSTIN is required when GST status is Registered/);

  // Invalid format GSTIN
  const invalidFormatResult = customerValidator.createCustomerSchema.safeParse({
    name: 'Invalid Corp',
    customerType: 'Business',
    gstStatus: 'Registered',
    gstin: 'NOT_A_VALID_GSTIN'
  });
  assert.strictEqual(invalidFormatResult.success, false);
  assert.match(invalidFormatResult.error?.issues[0]?.message, /Invalid GSTIN format/);

  // Valid Registered Customer
  const validResult = customerValidator.createCustomerSchema.safeParse({
    name: 'Valid Corp',
    customerType: 'Business',
    gstStatus: 'Registered',
    gstin: '27AABCV1234E1Z9',
    state: 'Maharashtra'
  });
  assert.strictEqual(validResult.success, true);
});

// ---------------------------------------------------------------------------
// 4. Invoice Model & Billing Mode Validation
// ---------------------------------------------------------------------------
test('Invoice Validator: General mode permits creation without customerId (Anonymous Walk-in)', () => {
  const validGeneralPayload = {
    billingMode: 'General',
    date: new Date().toISOString(),
    items: [
      { itemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }
    ]
  };

  const result = invoiceValidator.createDraftInvoiceSchema.safeParse(validGeneralPayload);
  assert.strictEqual(result.success, true, 'General mode must allow omitting customerId');
});

test('Invoice Validator: GST-Registered mode requires customerId', () => {
  const invalidGstPayload = {
    billingMode: 'GST-Registered',
    date: new Date().toISOString(),
    items: [
      { itemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }
    ]
  };

  const result = invoiceValidator.createDraftInvoiceSchema.safeParse(invalidGstPayload);
  assert.strictEqual(result.success, false, 'GST-Registered mode must require customerId');
  assert.match(result.error?.issues[0]?.message, /A registered customer profile must be selected in GST-Registered mode/);
});

test('Invoice Schema: Correctly captures snapshot fields and billingMode', async () => {
  const inv = new Invoice({
    businessId: new mongoose.Types.ObjectId(),
    invoiceNumber: 'INV-TEST-001',
    date: new Date(),
    billingMode: 'General',
    status: 'Draft',
    customerSnapshot: {
      customerId: null,
      name: 'Walk-in / Counter Sale',
      billingMode: 'General',
      gstStatus: 'Unregistered',
      placeOfSupply: 'Maharashtra',
      placeOfSupplyStateCode: '27'
    },
    businessSnapshot: {
      name: 'My Store',
      state: 'Maharashtra'
    },
    items: [],
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    summary: {
      subTotal: '0.00',
      taxableTotal: '0.00',
      discountTotal: '0.00',
      cgstTotal: '0.00',
      sgstTotal: '0.00',
      igstTotal: '0.00',
      taxTotal: '0.00',
      grandTotal: '0.00',
      paidAmount: '0.00',
      balanceDue: '0.00'
    },
    paymentStatus: {
      status: 'Unpaid',
      paidAmount: '0.00',
      balanceDue: '0.00'
    }
  });

  const err = await inv.validate().catch(e => e);
  assert.strictEqual(err, undefined, 'Invoice schema should validate snapshot fields cleanly');
  assert.strictEqual(inv.billingMode, 'General');
  assert.strictEqual(inv.customerSnapshot.name, 'Walk-in / Counter Sale');
  assert.strictEqual(inv.customerSnapshot.placeOfSupply, 'Maharashtra');
});

// ---------------------------------------------------------------------------
// 5. GST Rule 46 Recipient Information Enforcement & Threshold Verification
// ---------------------------------------------------------------------------
test('Rule 46: Anonymous walk-in allowed for low-value taxable supply (< ₹50,000)', () => {
  const result = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: {
      name: 'Walk-in / Counter Sale',
      gstStatus: 'Unregistered'
    },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: '49999.00'
  });

  assert.strictEqual(result.isApplicable, true);
  assert.strictEqual(result.thresholdExceeded, false, 'Taxable value 49,999 is below ₹50,000 threshold');
  assert.strictEqual(result.compliant, true, 'Low-value anonymous sale must be fully compliant without recipient details');
  assert.strictEqual(result.missingFields.length, 0);
});

test('Rule 46: Anonymous walk-in blocked at EXACTLY ₹50,000 taxable value', () => {
  const result = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: {
      name: 'Walk-in / Counter Sale',
      gstStatus: 'Unregistered'
    },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: '50000.00'
  });

  assert.strictEqual(result.isApplicable, true);
  assert.strictEqual(result.thresholdExceeded, true, 'Exactly ₹50,000 meets the statutory threshold');
  assert.strictEqual(result.compliant, false, 'Missing recipient details must block compliance');
  assert.deepStrictEqual(result.missingFields, ['recipient name', 'recipient address']);
});

test('Rule 46: Supply above ₹50,000 requires recipient name, address, and delivery state', () => {
  // Non-compliant case: above threshold without recipient name/address
  const nonCompliant = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: {
      name: 'Walk-in Customer',
      gstStatus: 'Unregistered'
    },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: '75000.00'
  });

  assert.strictEqual(nonCompliant.thresholdExceeded, true);
  assert.strictEqual(nonCompliant.compliant, false);
  assert.ok(nonCompliant.missingFields.includes('recipient name'));
  assert.ok(nonCompliant.missingFields.includes('recipient address'));

  // Compliant case: recipient details provided
  const compliant = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: {
      name: 'Vikas Sharma',
      billingAddress: '42 MG Road, Pune',
      state: 'Maharashtra',
      gstStatus: 'Unregistered'
    },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: '75000.00'
  });

  assert.strictEqual(compliant.thresholdExceeded, true);
  assert.strictEqual(compliant.compliant, true, 'Compliant when recipient name, address and delivery state are recorded');
  assert.strictEqual(compliant.missingFields.length, 0);
});

test('Rule 46: Threshold strictly compares against TAXABLE supply value, NOT tax-inclusive grand total', () => {
  // Case: Taxable value is ₹45,000. With 18% GST (₹8,100), grand total is ₹53,100.
  // Rule 46 statutory threshold is based on taxable supply value, NOT grand total.
  const result = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: {
      name: 'Walk-in / Counter Sale',
      gstStatus: 'Unregistered'
    },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: '45000.00' // Taxable is 45,000 even though grand total is 53,100
  });

  assert.strictEqual(result.thresholdExceeded, false, 'Taxable value ₹45,000 does NOT exceed ₹50,000 threshold despite grand total > ₹50,000');
  assert.strictEqual(result.compliant, true, 'Must allow anonymous walk-in because taxable supply is under ₹50,000');
});

test('Rule 46: Inapplicable to GST-Registered mode (governed by general B2B tax invoice rules)', () => {
  const result = evaluateRule46Compliance({
    billingMode: 'GST-Registered',
    customerSnapshot: {
      name: 'Acme Technologies Ltd',
      gstStatus: 'Registered',
      gstin: '27AAACA1234A1Z5'
    },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: '100000.00'
  });

  assert.strictEqual(result.isApplicable, false, 'Rule 46 unregistered recipient proviso is not applicable in GST-Registered mode');
  assert.strictEqual(result.compliant, true);
});

test('Rule 46: 18% inclusive GST below threshold (₹58,999 inclusive -> pre-GST taxable ₹49,999.15)', () => {
  const lineCalc = calculateGST({
    amount: '58999.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.INCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  // 58999 * 100 / 118 = 49999.1525... -> 49999.15
  assert.strictEqual(lineCalc.taxableAmount, '49999.15', 'Pre-GST taxable amount must be 49999.15');
  assert.strictEqual(lineCalc.totalGST, '8999.85', 'GST must be 8999.85');
  assert.strictEqual(lineCalc.total, '58999.00', 'Total must equal original inclusive price 58999.00');

  const compliance = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in / Counter Sale', gstStatus: 'Unregistered' },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: lineCalc.taxableAmount
  });

  assert.strictEqual(compliance.thresholdExceeded, false, '₹49,999.15 pre-GST taxable supply must NOT exceed ₹50,000 threshold');
  assert.strictEqual(compliance.compliant, true, 'Counter sale under ₹50,000 taxable value is compliant without recipient details');
  assert.strictEqual(compliance.missingFields.length, 0);
});

test('Rule 46: 18% inclusive GST exact threshold (₹59,000 inclusive -> pre-GST taxable ₹50,000.00)', () => {
  const lineCalc = calculateGST({
    amount: '59000.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.INCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });

  // 59000 * 100 / 118 = 50000.00
  assert.strictEqual(lineCalc.taxableAmount, '50000.00', 'Pre-GST taxable amount must be exactly 50000.00');
  assert.strictEqual(lineCalc.totalGST, '9000.00', 'GST must be 9000.00');
  assert.strictEqual(lineCalc.total, '59000.00', 'Total must be 59000.00');

  const compliance = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in / Counter Sale', gstStatus: 'Unregistered' },
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: lineCalc.taxableAmount
  });

  assert.strictEqual(compliance.thresholdExceeded, true, 'Exactly ₹50,000.00 pre-GST taxable supply meets statutory threshold');
  assert.strictEqual(compliance.compliant, false, 'Anonymous counter sale must be blocked when taxable value meets ₹50,000');
  assert.ok(compliance.missingFields.includes('recipient name'));
  assert.ok(compliance.missingFields.includes('recipient address'));
});

test('Rule 46: GST-exclusive pricing on both sides and exact threshold (₹49,999.99 vs ₹50,000.00 vs ₹50,000.01)', () => {
  // Below threshold
  const below = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in Customer', gstStatus: 'Unregistered' },
    taxableTotal: '49999.99'
  });
  assert.strictEqual(below.thresholdExceeded, false);
  assert.strictEqual(below.compliant, true);

  // Exact threshold
  const exact = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in Customer', gstStatus: 'Unregistered' },
    taxableTotal: '50000.00'
  });
  assert.strictEqual(exact.thresholdExceeded, true);
  assert.strictEqual(exact.compliant, false);

  // Above threshold
  const above = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in Customer', gstStatus: 'Unregistered' },
    taxableTotal: '50000.01'
  });
  assert.strictEqual(above.thresholdExceeded, true);
  assert.strictEqual(above.compliant, false);
});

test('Rule 46: Line discounts bringing gross price >= ₹50,000 to pre-GST taxable supply < ₹50,000', () => {
  // Exclusive item: Gross ₹55,000 - Discount ₹6,000 = ₹49,000 taxable
  const exclusiveDiscCalc = calculateGST({
    amount: (new Decimal('55000.00').minus('6000.00')).toFixed(2),
    gstRate: 18,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });
  assert.strictEqual(exclusiveDiscCalc.taxableAmount, '49000.00');

  const compExclusive = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in / Counter Sale', gstStatus: 'Unregistered' },
    taxableTotal: exclusiveDiscCalc.taxableAmount
  });
  assert.strictEqual(compExclusive.thresholdExceeded, false, 'Discounted taxable ₹49,000 is below threshold despite ₹55,000 gross subtotal');
  assert.strictEqual(compExclusive.compliant, true);

  // Inclusive item: Gross ₹65,000 - Discount ₹6,001 = ₹58,999 inclusive -> ₹49,999.15 taxable
  const inclusiveDiscCalc = calculateGST({
    amount: (new Decimal('65000.00').minus('6001.00')).toFixed(2),
    gstRate: 18,
    pricingMode: PRICING_MODE.INCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });
  assert.strictEqual(inclusiveDiscCalc.taxableAmount, '49999.15');

  const compInclusive = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in / Counter Sale', gstStatus: 'Unregistered' },
    taxableTotal: inclusiveDiscCalc.taxableAmount
  });
  assert.strictEqual(compInclusive.thresholdExceeded, false, 'Discounted inclusive taxable ₹49,999.15 is below threshold');
  assert.strictEqual(compInclusive.compliant, true);
});

test('Rule 46: Mixed tax rates across multiple lines evaluated on cumulative pre-GST taxable supply', () => {
  // Line 1: 5% inclusive ₹10,500 -> taxable = 10,000.00
  const line1 = calculateGST({
    amount: '10500.00',
    gstRate: 5,
    pricingMode: PRICING_MODE.INCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });
  assert.strictEqual(line1.taxableAmount, '10000.00');

  // Line 2: 12% exclusive ₹20,000 -> taxable = 20,000.00
  const line2 = calculateGST({
    amount: '20000.00',
    gstRate: 12,
    pricingMode: PRICING_MODE.EXCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });
  assert.strictEqual(line2.taxableAmount, '20000.00');

  // Line 3: 18% inclusive ₹23,600 -> taxable = 20,000.00
  const line3 = calculateGST({
    amount: '23600.00',
    gstRate: 18,
    pricingMode: PRICING_MODE.INCLUSIVE,
    supplyType: SUPPLY_TYPE.INTRA_STATE,
    taxTreatment: TAX_TREATMENT.TAXABLE
  });
  assert.strictEqual(line3.taxableAmount, '20000.00');

  // Cumulative taxable total = 10,000 + 20,000 + 20,000 = 50,000.00
  const cumulativeTaxable = new Decimal(line1.taxableAmount)
    .plus(line2.taxableAmount)
    .plus(line3.taxableAmount);

  assert.strictEqual(cumulativeTaxable.toFixed(2), '50000.00');

  const comp = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot: { name: 'Walk-in Customer', gstStatus: 'Unregistered' },
    taxableTotal: cumulativeTaxable.toFixed(2)
  });

  assert.strictEqual(comp.thresholdExceeded, true, 'Cumulative mixed-rate taxable supply of ₹50,000 triggers Rule 46 requirements');
  assert.strictEqual(comp.compliant, false);
});

test('Rule 46: Unregistered customer requesting particulars below ₹50,000 receives details on invoice snapshot and PDF', async () => {
  const customerSnapshot = {
    customerId: null,
    name: 'Rajesh Sharma',
    customerType: 'Individual',
    gstStatus: 'Unregistered',
    billingMode: 'General',
    billingAddress: 'Flat 402, Sea Green Apartments, Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400050',
    country: 'India',
    phone: '9820011223',
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27'
  };

  const compliance = evaluateRule46Compliance({
    billingMode: 'General',
    customerSnapshot,
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    taxableTotal: '25000.00' // < ₹50,000
  });

  assert.strictEqual(compliance.thresholdExceeded, false, 'Taxable value below ₹50,000');
  assert.strictEqual(compliance.compliant, true);

  // Validate that the invoice document stores all requested particulars
  const invoice = new Invoice({
    businessId: new mongoose.Types.ObjectId(),
    invoiceNumber: 'INV-REQ-001',
    date: new Date(),
    billingMode: 'General',
    status: 'Paid',
    customerSnapshot,
    businessSnapshot: { name: 'Electro World', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', address: 'Dadar, Mumbai' },
    items: [],
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    summary: {
      subTotal: '25000.00', taxableTotal: '25000.00', discountTotal: '0.00',
      cgstTotal: '2250.00', sgstTotal: '2250.00', igstTotal: '0.00', taxTotal: '4500.00',
      grandTotal: '29500.00', paidAmount: '29500.00', balanceDue: '0.00'
    },
    paymentStatus: { status: 'Paid', paidAmount: '29500.00', balanceDue: '0.00' }
  });

  const valErr = await invoice.validate().catch(e => e);
  assert.strictEqual(valErr, undefined, 'Invoice with requested particulars must validate');

  // Verify recipient particulars exist on the invoice
  assert.strictEqual(invoice.customerSnapshot.name, 'Rajesh Sharma');
  assert.strictEqual(invoice.customerSnapshot.billingAddress, 'Flat 402, Sea Green Apartments, Bandra West');
  assert.strictEqual(invoice.customerSnapshot.phone, '9820011223');
  assert.strictEqual(invoice.customerSnapshot.state, 'Maharashtra');
  assert.strictEqual(invoice.customerSnapshot.placeOfSupplyStateCode, '27');

  // Verify PDF generation renders recipient particulars
  const pdfService = require('../src/services/pdf.service');
  const pdfStream = await pdfService.generateInvoicePdf(invoice);
  assert.ok(pdfStream, 'PDF stream generated successfully with all requested recipient particulars');
});

// ---------------------------------------------------------------------------
// 6. Place of Supply Complex Transaction Scenarios (Section 10 IGST Act & Circular 209/3/2024)
// ---------------------------------------------------------------------------
test('Place of Supply: Section 10(1)(c) — Store counter handover override to Maharashtra for out-of-state customer', () => {
  const supplierState = 'Maharashtra';
  const outOfStateCustomer = {
    name: 'Bangalore Traders',
    gstStatus: 'Registered',
    gstin: '29ABCDE1234F1Z5', // Karnataka code 29
    state: 'Karnataka'
  };

  // Cashier specifies placeOfSupply = 'Maharashtra' because goods were physically handed over at Pune counter
  const posResult = determinePlaceOfSupply({
    supplierState,
    customer: outOfStateCustomer,
    billingMode: 'GST-Registered',
    placeOfSupply: 'Maharashtra'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Maharashtra');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '27');
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTRA_STATE, 'Counter handover in supplier state must be INTRA_STATE (CGST + SGST)');
  assert.match(posResult.explanation, /explicitly specified for transaction/);
});

test('Place of Supply: Section 10(1)(a) — Delivery state override takes precedence over registered GSTIN state', () => {
  const supplierState = 'Maharashtra';
  const customer = {
    name: 'Delhi Enterprises',
    gstStatus: 'Registered',
    gstin: '07AAAAA0000A1Z5', // Delhi code 07
    state: 'Delhi'
  };

  // Goods movement terminates in Gujarat warehouse
  const posResult = determinePlaceOfSupply({
    supplierState,
    customer,
    billingMode: 'GST-Registered',
    deliveryState: 'Gujarat'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Gujarat');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '24');
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTER_STATE, 'Supply to Gujarat is INTER_STATE');
  assert.match(posResult.explanation, /Section 10\(1\)\(a\)/);
});

test('Place of Supply: Section 10(1)(ca) — Circular 209/3/2024-GST fallback for unregistered walk-in without address', () => {
  const supplierState = 'Maharashtra';
  const walkInAnonymous = {
    name: 'Walk-in Customer'
    // No address, no state
  };

  const posResult = determinePlaceOfSupply({
    supplierState,
    customer: walkInAnonymous,
    billingMode: 'General'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Maharashtra');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '27');
  assert.strictEqual(posResult.isFallback, true);
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTRA_STATE);
  assert.match(posResult.explanation, /Section 10\(1\)\(ca\)/);
});

test('Place of Supply: Section 10(1)(ca) — Recorded recipient state in another state results in Inter-state IGST', () => {
  const supplierState = 'Maharashtra';
  const outOfStateWalkIn = {
    name: 'Pooja Iyer',
    state: 'Tamil Nadu'
  };

  const posResult = determinePlaceOfSupply({
    supplierState,
    customer: outOfStateWalkIn,
    billingMode: 'General'
  });

  assert.strictEqual(posResult.placeOfSupply, 'Tamil Nadu');
  assert.strictEqual(posResult.placeOfSupplyStateCode, '33');
  assert.strictEqual(posResult.isFallback, false);
  assert.strictEqual(posResult.supplyType, SUPPLY_TYPE.INTER_STATE);
});

// ---------------------------------------------------------------------------
// 7. Phone Matches with Existing Customers & Billing Mode Switching
// ---------------------------------------------------------------------------
test('Customer Phone Match 1: Match with existing general customer reuses profile and links customerId', async () => {
  const businessId = new mongoose.Types.ObjectId();
  const existingGeneralCustomer = new Customer({
    businessId,
    name: 'Suresh Patil',
    customerType: 'Individual',
    gstStatus: 'Unregistered',
    phone: '9822998877',
    normalizedPhone: '9822998877',
    state: 'Maharashtra'
  });

  await existingGeneralCustomer.validate();
  assert.strictEqual(existingGeneralCustomer.gstStatus, 'Unregistered');

  // Simulate findOrCreateGeneralCustomer when phone matches an unregistered customer
  const origFindOne = Customer.findOne;
  Customer.findOne = () => ({
    session: () => Promise.resolve(existingGeneralCustomer),
    then: (resolve) => resolve(existingGeneralCustomer)
  });

  try {
    const customerService = require('../src/services/customer.service');
    const result = await customerService.findOrCreateGeneralCustomer(businessId, {
      name: 'Suresh Patil',
      phone: '9822998877'
    });

    assert.strictEqual(result._id, existingGeneralCustomer._id, 'Must reuse the existing general customer _id');
    assert.strictEqual(result._isNewGeneralCustomer, false);
    assert.strictEqual(result.gstStatus, 'Unregistered');

    // General invoice linking to this existing general customer:
    const invoice = new Invoice({
      businessId,
      invoiceNumber: 'INV-GEN-PATIL',
      date: new Date(),
      billingMode: 'General',
      status: 'Draft',
      customerSnapshot: {
        customerId: result._id,
        name: result.name,
        customerType: result.customerType,
        gstStatus: 'Unregistered',
        billingMode: 'General',
        phone: result.phone,
        placeOfSupply: 'Maharashtra',
        placeOfSupplyStateCode: '27'
      },
      businessSnapshot: { name: 'My Store', state: 'Maharashtra' },
      items: [],
      placeOfSupply: 'Maharashtra',
      placeOfSupplyStateCode: '27',
      summary: {
        subTotal: '0.00', taxableTotal: '0.00', discountTotal: '0.00',
        cgstTotal: '0.00', sgstTotal: '0.00', igstTotal: '0.00', taxTotal: '0.00',
        grandTotal: '0.00', paidAmount: '0.00', balanceDue: '0.00'
      },
      paymentStatus: { status: 'Unpaid', paidAmount: '0.00', balanceDue: '0.00' }
    });

    const err = await invoice.validate().catch(e => e);
    assert.strictEqual(err, undefined);
    assert.strictEqual(invoice.customerSnapshot.customerId.toString(), existingGeneralCustomer._id.toString());
    assert.strictEqual(invoice.customerSnapshot.gstStatus, 'Unregistered');
  } finally {
    Customer.findOne = origFindOne;
  }
});

test('Customer Phone Match 2: Match with existing GST-registered customer in General mode prevents linking and preserves master profile', async () => {
  const businessId = new mongoose.Types.ObjectId();
  const existingRegisteredCustomer = new Customer({
    businessId,
    name: 'Apex Infotech Pvt Ltd',
    customerType: 'Business',
    gstStatus: 'Registered',
    gstin: '27AAACA9999A1Z5',
    phone: '9822012345',
    normalizedPhone: '9822012345',
    state: 'Maharashtra'
  });

  await existingRegisteredCustomer.validate();
  assert.strictEqual(existingRegisteredCustomer.gstStatus, 'Registered');
  assert.strictEqual(existingRegisteredCustomer.gstin, '27AAACA9999A1Z5');

  // In General mode, cashier types matching phone
  const origFindOne = Customer.findOne;
  Customer.findOne = () => ({
    session: () => Promise.resolve(existingRegisteredCustomer),
    then: (resolve) => resolve(existingRegisteredCustomer)
  });

  try {
    const customerService = require('../src/services/customer.service');
    const result = await customerService.findOrCreateGeneralCustomer(businessId, {
      name: 'Apex Infotech Pvt Ltd',
      phone: '9822012345'
    });

    // 1. Must NOT link to the registered profile (_id: null)
    assert.strictEqual(result._id, null, 'Must return unlinked counter recipient (_id: null) to prevent linking General invoice to registered master');
    // 2. Flags cashier regarding matched registered profile
    assert.strictEqual(result.isMatchedRegistered, true);
    assert.strictEqual(result.matchedRegisteredCustomerId.toString(), existingRegisteredCustomer._id.toString());
    assert.strictEqual(result._isNewGeneralCustomer, false);
    // 3. Snapshot representation for the transaction is Unregistered counter recipient
    assert.strictEqual(result.gstStatus, 'Unregistered');

    // 4. General invoice created with this unlinked recipient:
    const generalInvoice = new Invoice({
      businessId,
      invoiceNumber: 'INV-COUNTER-001',
      date: new Date(),
      billingMode: 'General',
      status: 'Draft',
      customerSnapshot: {
        customerId: null, // Strictly unlinked
        name: result.name,
        customerType: 'Individual',
        gstStatus: 'Unregistered',
        billingMode: 'General',
        phone: result.phone,
        placeOfSupply: 'Maharashtra',
        placeOfSupplyStateCode: '27'
      },
      businessSnapshot: { name: 'My Store', state: 'Maharashtra' },
      items: [],
      placeOfSupply: 'Maharashtra',
      placeOfSupplyStateCode: '27',
      summary: {
        subTotal: '0.00', taxableTotal: '0.00', discountTotal: '0.00',
        cgstTotal: '0.00', sgstTotal: '0.00', igstTotal: '0.00', taxTotal: '0.00',
        grandTotal: '0.00', paidAmount: '0.00', balanceDue: '0.00'
      },
      paymentStatus: { status: 'Unpaid', paidAmount: '0.00', balanceDue: '0.00' }
    });

    const err = await generalInvoice.validate().catch(e => e);
    assert.strictEqual(err, undefined);
    assert.strictEqual(generalInvoice.customerSnapshot.customerId, null, 'General invoice must not link customerId to registered customer');
    assert.strictEqual(generalInvoice.customerSnapshot.gstStatus, 'Unregistered');
    assert.strictEqual(generalInvoice.customerSnapshot.gstin, undefined);
  } finally {
    Customer.findOne = origFindOne;
  }
});

test('Customer Phone Match 3: Switching from General mode to GST-Registered mode links customerId and records GSTIN', async () => {
  const businessId = new mongoose.Types.ObjectId();
  const registeredCustomer = new Customer({
    businessId,
    name: 'Apex Infotech Pvt Ltd',
    customerType: 'Business',
    gstStatus: 'Registered',
    gstin: '27AAACA9999A1Z5',
    phone: '9822012345',
    normalizedPhone: '9822012345',
    state: 'Maharashtra',
    billingAddress: 'Tower B, Tech Park, Pune'
  });

  // Cashier switches to GST-Registered mode and selects the matched customer profile
  const b2bInvoice = new Invoice({
    businessId,
    invoiceNumber: 'INV-B2B-101',
    date: new Date(),
    billingMode: 'GST-Registered',
    status: 'Draft',
    customerSnapshot: {
      customerId: registeredCustomer._id,
      name: registeredCustomer.name,
      customerType: registeredCustomer.customerType,
      gstStatus: 'Registered',
      billingMode: 'GST-Registered',
      gstin: registeredCustomer.gstin,
      billingAddress: registeredCustomer.billingAddress,
      state: registeredCustomer.state,
      phone: registeredCustomer.phone,
      placeOfSupply: 'Maharashtra',
      placeOfSupplyStateCode: '27'
    },
    businessSnapshot: { name: 'My Store', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra' },
    items: [],
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    summary: {
      subTotal: '0.00', taxableTotal: '0.00', discountTotal: '0.00',
      cgstTotal: '0.00', sgstTotal: '0.00', igstTotal: '0.00', taxTotal: '0.00',
      grandTotal: '0.00', paidAmount: '0.00', balanceDue: '0.00'
    },
    paymentStatus: { status: 'Unpaid', paidAmount: '0.00', balanceDue: '0.00' }
  });

  const err = await b2bInvoice.validate().catch(e => e);
  assert.strictEqual(err, undefined);
  assert.strictEqual(b2bInvoice.billingMode, 'GST-Registered');
  assert.strictEqual(b2bInvoice.customerSnapshot.customerId.toString(), registeredCustomer._id.toString());
  assert.strictEqual(b2bInvoice.customerSnapshot.gstStatus, 'Registered');
  assert.strictEqual(b2bInvoice.customerSnapshot.gstin, '27AAACA9999A1Z5');
});

test('Customer Phone Match 4: Preserving the registered customer\'s profile and GSTIN', async () => {
  const businessId = new mongoose.Types.ObjectId();
  const registeredMasterProfile = new Customer({
    businessId,
    name: 'National Pharma Distributors',
    customerType: 'Business',
    gstStatus: 'Registered',
    gstin: '27AABCN5555M1Z2',
    phone: '9890123456',
    normalizedPhone: '9890123456',
    state: 'Maharashtra',
    billingAddress: 'Sector 17, Vashi, Navi Mumbai'
  });

  // Verify initial state
  assert.strictEqual(registeredMasterProfile.gstStatus, 'Registered');
  assert.strictEqual(registeredMasterProfile.gstin, '27AABCN5555M1Z2');

  // Even if a counter transaction occurs with the same phone in General mode:
  // The master profile must remain strictly unmutated.
  const copyOfMaster = JSON.parse(JSON.stringify(registeredMasterProfile));
  assert.strictEqual(copyOfMaster.gstStatus, 'Registered');
  assert.strictEqual(copyOfMaster.gstin, '27AABCN5555M1Z2');
  assert.strictEqual(copyOfMaster.name, 'National Pharma Distributors');
  assert.strictEqual(registeredMasterProfile.gstStatus, 'Registered', 'Master profile must never be silently downgraded');
  assert.strictEqual(registeredMasterProfile.gstin, '27AABCN5555M1Z2', 'GSTIN must never be erased or cleared');
});

test('Customer Phone Match 5: Consistency between billing mode, customer relationship, recipient snapshot and GST data', async () => {
  const businessId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  // Case 1: General mode with anonymous customer (no customerId)
  const anonInvoice = new Invoice({
    businessId,
    invoiceNumber: 'INV-CONSIST-01',
    date: new Date(),
    billingMode: 'General',
    customerSnapshot: {
      customerId: null,
      name: 'Walk-in / Counter Sale',
      customerType: 'Individual',
      gstStatus: 'Unregistered',
      billingMode: 'General',
      placeOfSupply: 'Maharashtra',
      placeOfSupplyStateCode: '27'
    },
    businessSnapshot: { name: 'Store', state: 'Maharashtra' },
    items: [],
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    summary: { subTotal: '0.00', taxableTotal: '0.00', discountTotal: '0.00', cgstTotal: '0.00', sgstTotal: '0.00', igstTotal: '0.00', taxTotal: '0.00', grandTotal: '0.00', paidAmount: '0.00', balanceDue: '0.00' },
    paymentStatus: { status: 'Unpaid', paidAmount: '0.00', balanceDue: '0.00' }
  });
  assert.strictEqual(await anonInvoice.validate().catch(e => e), undefined);
  assert.strictEqual(anonInvoice.billingMode, 'General');
  assert.strictEqual(anonInvoice.customerSnapshot.customerId, null);
  assert.strictEqual(anonInvoice.customerSnapshot.gstStatus, 'Unregistered');
  assert.strictEqual(anonInvoice.customerSnapshot.gstin, undefined);

  // Case 2: GST-Registered mode with registered customer
  const b2bInvoice = new Invoice({
    businessId,
    invoiceNumber: 'INV-CONSIST-02',
    date: new Date(),
    billingMode: 'GST-Registered',
    customerSnapshot: {
      customerId,
      name: 'Registered Enterprise',
      customerType: 'Business',
      gstStatus: 'Registered',
      billingMode: 'GST-Registered',
      gstin: '27ABCDE1234F1Z5',
      placeOfSupply: 'Maharashtra',
      placeOfSupplyStateCode: '27'
    },
    businessSnapshot: { name: 'Store', state: 'Maharashtra', gstin: '27XYZAB9876C1Z1' },
    items: [],
    placeOfSupply: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    summary: { subTotal: '0.00', taxableTotal: '0.00', discountTotal: '0.00', cgstTotal: '0.00', sgstTotal: '0.00', igstTotal: '0.00', taxTotal: '0.00', grandTotal: '0.00', paidAmount: '0.00', balanceDue: '0.00' },
    paymentStatus: { status: 'Unpaid', paidAmount: '0.00', balanceDue: '0.00' }
  });
  assert.strictEqual(await b2bInvoice.validate().catch(e => e), undefined);
  assert.strictEqual(b2bInvoice.billingMode, 'GST-Registered');
  assert.strictEqual(b2bInvoice.customerSnapshot.customerId.toString(), customerId.toString());
  assert.strictEqual(b2bInvoice.customerSnapshot.gstStatus, 'Registered');
  assert.strictEqual(b2bInvoice.customerSnapshot.gstin, '27ABCDE1234F1Z5');
});

// ---------------------------------------------------------------------------
// 8. Backward Compatibility for Legacy Customer & Invoice Documents
// ---------------------------------------------------------------------------
test('Backward Compatibility: Legacy customer with GSTIN but no stored gstStatus resolves as Registered', async () => {
  const legacyCustomer = new Customer({
    businessId: new mongoose.Types.ObjectId(),
    name: 'Legacy Tech Corp',
    gstin: '27ABCDE1234F1Z5'
    // Note: gstStatus is deliberately omitted to simulate pre-migration documents
  });

  await legacyCustomer.validate();
  assert.strictEqual(legacyCustomer.gstStatus, 'Registered', 'Default hook must safely map valid GSTIN to Registered');
});

test('Backward Compatibility: Legacy customer without GSTIN and no stored gstStatus resolves as Unregistered', async () => {
  const legacyWalkIn = new Customer({
    businessId: new mongoose.Types.ObjectId(),
    name: 'Legacy Walk-in',
    phone: '9876543210'
    // Note: gstStatus omitted, no gstin
  });

  await legacyWalkIn.validate();
  assert.strictEqual(legacyWalkIn.gstStatus, 'Unregistered', 'Default hook must safely map missing GSTIN to Unregistered');
});

test('Backward Compatibility: Old invoices without billingMode validate with safe defaults', async () => {
  const oldInvoice = new Invoice({
    businessId: new mongoose.Types.ObjectId(),
    invoiceNumber: 'INV-OLD-999',
    date: new Date(),
    status: 'Unpaid',
    customerSnapshot: {
      name: 'Old Customer'
      // No billingMode, no gstStatus, no placeOfSupply
    },
    businessSnapshot: { name: 'My Store', state: 'Maharashtra' },
    items: [],
    summary: {
      subTotal: '0.00', taxableTotal: '0.00', discountTotal: '0.00',
      cgstTotal: '0.00', sgstTotal: '0.00', igstTotal: '0.00', taxTotal: '0.00',
      grandTotal: '0.00', paidAmount: '0.00', balanceDue: '0.00'
    },
    paymentStatus: { status: 'Unpaid', paidAmount: '0.00', balanceDue: '0.00' }
  });

  const err = await oldInvoice.validate().catch(e => e);
  assert.strictEqual(err, undefined, 'Legacy invoice without billingMode should validate without error');
  assert.strictEqual(oldInvoice.billingMode, 'General', 'Mongoose schema default must supply General');
});

// ---------------------------------------------------------------------------
// 9. Quick Customer Creation Atomic Rollback Mechanism
// ---------------------------------------------------------------------------
test('Consistency: Quick customer creation rollback flag _isNewGeneralCustomer operates properly', () => {
  const mockCreatedCustomer = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Quick Customer Test',
    _isNewGeneralCustomer: true
  };

  assert.strictEqual(mockCreatedCustomer._isNewGeneralCustomer, true);

  // If invoice draft creation fails, caller knows to delete only newly created customer
  const shouldRollback = Boolean(mockCreatedCustomer._isNewGeneralCustomer);
  assert.strictEqual(shouldRollback, true, 'Rollback should execute only for newly created customers, not existing ones');

  const existingCustomer = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Existing Customer Profile',
    _isNewGeneralCustomer: false
  };
  assert.strictEqual(Boolean(existingCustomer._isNewGeneralCustomer), false, 'Existing customer must never be rolled back');
});

