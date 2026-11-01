const mongoose = require('mongoose');
const Decimal = require('decimal.js');
const Money = require('../utils/money');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Business = require('../models/Business');
const Customer = require('../models/Customer');
const Item = require('../models/Item');
const TaxConfig = require('../models/TaxConfig');
const { calculateGST, determinePlaceOfSupply, determineSupplyType, evaluateRule46Compliance, PRICING_MODE, TAX_TREATMENT } = require('./gstCalculation.service');
const customerService = require('./customer.service');
const AppError = require('../utils/AppError');
const { getBounds } = require('../utils/timezone');
const { generateDocumentIntegrityHash, createVerificationCodes } = require('../utils/documentAuth');

const roundQty = (val) => Math.round(Number(val) * 100) / 100;

/**
 * Get all invoices for the authenticated business with search, filtering and pagination.
 */
const getInvoices = async (businessId, query = {}) => {
  const { page = 1, limit = 20, search, status, billingMode, startDate, endDate, customerId, sort = 'date', order = 'desc' } = query;

  const filter = { businessId: new mongoose.Types.ObjectId(businessId) };

  if (status) {
    filter.status = status;
  }

  if (billingMode) {
    if (billingMode === 'GST-Registered') {
      filter.$or = [
        { billingMode: 'GST-Registered' },
        { billingMode: { $exists: false }, 'customerSnapshot.gstin': { $exists: true, $ne: '' } }
      ];
    } else if (billingMode === 'General') {
      filter.$or = [
        { billingMode: 'General' },
        { billingMode: { $exists: false }, 'customerSnapshot.gstin': { $in: [null, ''] } }
      ];
    }
  }

  if (customerId) {
    filter['customerSnapshot.customerId'] = new mongoose.Types.ObjectId(customerId);
  }

  if (startDate && endDate) {
    const { startBound, endBound } = getBounds(startDate, endDate);
    filter.date = { $gte: startBound, $lt: endBound };
  }

  if (search) {
    const escapedSearch = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const orConditions = [
      { invoiceNumber: { $regex: escapedSearch, $options: 'i' } },
      { 'customerSnapshot.name': { $regex: escapedSearch, $options: 'i' } }
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: orConditions }];
      delete filter.$or;
    } else {
      filter.$or = orConditions;
    }
  }

  const sortDirection = order === 'asc' ? 1 : -1;
  const sortMap = {
    date: 'date',
    invoiceNumber: 'invoiceNumber',
    grandTotal: 'summary.grandTotal',
    createdAt: 'createdAt'
  };
  const mappedSort = sortMap[sort] || 'date';
  const sortObj = { [mappedSort]: sortDirection, _id: -1 };

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Invoice.find(filter)
      .select('-items -businessSnapshot -notes -terms') // Exclude large fields
      .sort(sortObj)
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    }
  };
};

/**
 * Perform all authoritative calculations for an invoice payload and generate the snapshots.
 * Returns the fully computed invoice object (without saving).
 */
const calculateInvoice = async (businessId, optionsOrCustomerId, itemsPayload) => {
  // 1. Fetch Business (needed for state comparison and invoice prefix snapshotting)
  const business = await Business.findById(businessId);
  if (!business) throw new AppError('Business not found', 404);
  const supplierState = (business.state && business.state.trim()) || 'Maharashtra';

  // Parse input options for backward compatibility
  let customerId = null;
  let billingMode = 'General';
  let quickCustomer = null;
  let placeOfSupplyInput = null;
  let deliveryState = null;
  let showPhoneOnInvoice = false;

  if (typeof optionsOrCustomerId === 'string' || optionsOrCustomerId instanceof mongoose.Types.ObjectId) {
    customerId = optionsOrCustomerId.toString();
  } else if (optionsOrCustomerId && typeof optionsOrCustomerId === 'object') {
    customerId = optionsOrCustomerId.customerId || null;
    billingMode = optionsOrCustomerId.billingMode || null;
    quickCustomer = optionsOrCustomerId.quickCustomer || null;
    placeOfSupplyInput = optionsOrCustomerId.placeOfSupply || null;
    deliveryState = optionsOrCustomerId.deliveryState || null;
    if (optionsOrCustomerId.showPhoneOnInvoice !== undefined) {
      showPhoneOnInvoice = Boolean(optionsOrCustomerId.showPhoneOnInvoice);
    } else if (quickCustomer?.showPhoneOnInvoice !== undefined) {
      showPhoneOnInvoice = Boolean(quickCustomer.showPhoneOnInvoice);
    }
  }

  let customer = null;
  let customerSnapshot = null;
  let posResult = null;

  // 2. Fetch Customer / Resolve Place of Supply
  if (customerId) {
    customer = await Customer.findOne({ _id: customerId, businessId });
    if (!customer) throw new AppError('Customer not found or does not belong to this business', 404);

    const hasValidGstin = customer.gstin && /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(customer.gstin);
    const isRegisteredCustomer = customer.gstStatus === 'Registered' || Boolean(customer.gstin);

    if (!billingMode) {
      billingMode = hasValidGstin ? 'GST-Registered' : 'General';
    }

    if (billingMode === 'GST-Registered') {
      if (!hasValidGstin) {
        throw new AppError(`Customer "${customer.name}" does not have a valid 15-character GSTIN. Please select a GST-registered customer or switch to General billing mode.`, 400);
      }
      posResult = determinePlaceOfSupply({
        supplierState,
        isGstRegistered: true,
        recipientState: customer.state,
        deliveryState,
        placeOfSupply: placeOfSupplyInput,
        gstin: customer.gstin
      });
    } else {
      posResult = determinePlaceOfSupply({
        supplierState,
        isGstRegistered: false,
        recipientState: customer.state || placeOfSupplyInput,
        deliveryState,
        placeOfSupply: placeOfSupplyInput
      });
    }

    // If billingMode is General and the customer master profile is Registered,
    // do NOT link customerId to the registered master profile to prevent inconsistent representation
    // or polluting the registered entity's ledger with unclaimable counter sales.
    const effectiveSnapshotCustomerId = (billingMode === 'General' && isRegisteredCustomer)
      ? null
      : customer._id;

    customerSnapshot = {
      customerId: effectiveSnapshotCustomerId,
      name: customer.name,
      customerType: customer.customerType || 'Individual',
      gstStatus: billingMode === 'GST-Registered' ? (customer.gstStatus || 'Registered') : 'Unregistered',
      billingMode,
      placeOfSupply: posResult.placeOfSupply,
      placeOfSupplyStateCode: posResult.placeOfSupplyStateCode,
      gstin: billingMode === 'GST-Registered' ? customer.gstin : undefined,
      pan: customer.pan,
      billingAddress: customer.billingAddress,
      city: customer.city,
      state: customer.state,
      pinCode: customer.pinCode,
      country: customer.country,
      email: customer.email,
      phone: customer.phone,
      showPhoneOnInvoice
    };
  } else if (quickCustomer && (quickCustomer.name || quickCustomer.phone || quickCustomer.billingAddress || quickCustomer.address || quickCustomer.state)) {
    const recipientState = quickCustomer.state || placeOfSupplyInput;
    posResult = determinePlaceOfSupply({
      supplierState,
      isGstRegistered: false,
      recipientState,
      deliveryState,
      placeOfSupply: placeOfSupplyInput
    });

    customerSnapshot = {
      customerId: null,
      name: (quickCustomer.name && quickCustomer.name.trim()) || 'Walk-in Customer',
      customerType: 'Individual',
      gstStatus: 'Unregistered',
      billingMode: 'General',
      placeOfSupply: posResult.placeOfSupply,
      placeOfSupplyStateCode: posResult.placeOfSupplyStateCode,
      billingAddress: quickCustomer.billingAddress || quickCustomer.address,
      city: quickCustomer.city,
      state: quickCustomer.state || posResult.placeOfSupply,
      pinCode: quickCustomer.pinCode,
      country: quickCustomer.country || 'India',
      email: quickCustomer.email,
      phone: quickCustomer.phone,
      showPhoneOnInvoice
    };
  } else {
    // Anonymous Walk-in Sale
    if (billingMode === 'GST-Registered') {
      throw new AppError('A registered customer profile must be selected in GST-Registered billing mode.', 400);
    }
    posResult = determinePlaceOfSupply({
      supplierState,
      isGstRegistered: false,
      recipientState: placeOfSupplyInput || null,
      deliveryState,
      placeOfSupply: placeOfSupplyInput
    });

    customerSnapshot = {
      customerId: null,
      name: 'Walk-in / Counter Sale',
      customerType: 'Individual',
      gstStatus: 'Unregistered',
      billingMode: 'General',
      placeOfSupply: posResult.placeOfSupply,
      placeOfSupplyStateCode: posResult.placeOfSupplyStateCode,
      country: 'India'
    };
  }

  const supplyType = posResult.supplyType;

  // 3. Process Line Items
  const itemsSnapshot = [];
  let subTotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  let taxableTotal = new Decimal(0);
  let cgstTotal = new Decimal(0);
  let sgstTotal = new Decimal(0);
  let igstTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  let grandTotal = new Decimal(0);

  // --- BULK FETCHING ---
  const itemIds = [...new Set(itemsPayload.map(p => p.itemId).filter(Boolean))];
  const items = itemIds.length > 0 ? await Item.find({ _id: { $in: itemIds }, businessId }) : [];
  const itemMap = new Map(items.map(i => [i._id.toString(), i]));

  const hsnSacs = [...new Set(items.map(i => i.hsnSac).filter(Boolean))];
  const taxConfigs = hsnSacs.length > 0 ? await TaxConfig.find({ hsnSac: { $in: hsnSacs }, businessId }) : [];
  const taxConfigMap = new Map(taxConfigs.map(tc => [tc.hsnSac, tc]));
  // ---------------------

  for (const payloadItem of itemsPayload) {
    let item;
    if (payloadItem.itemId) {
      item = itemMap.get(payloadItem.itemId.toString());
      if (!item) throw new AppError(`Item not found (ID: ${payloadItem.itemId})`, 404);
    } else {
      // Ad-hoc on-demand item
      item = {
        _id: null,
        name: payloadItem.name ? payloadItem.name.trim() : 'Custom Item',
        type: payloadItem.type === 'Service' ? 'Service' : 'Product',
        unitPrice: payloadItem.unitPriceOverride || '0.00',
        description: '',
        sku: '',
        hsnSac: null,
        taxType: 'Exclusive',
        unit: 'unit'
      };
    }

    // Determine unit price
    const rawUnitPrice = payloadItem.unitPriceOverride !== undefined
      ? payloadItem.unitPriceOverride
      : (item.unitPrice || '0.00');
    const unitPrice = Money.parseInput(rawUnitPrice, { fieldName: 'unitPrice' });
    const unitPriceDec = new Decimal(unitPrice);

    const quantityDec = new Decimal(payloadItem.quantity);
    const rawDiscount = payloadItem.discount !== undefined ? payloadItem.discount : '0.00';
    const discount = Money.parseInput(rawDiscount, { isOptional: true, fieldName: 'discount' }) || '0.00';
    const discountDec = new Decimal(discount);
    const pricingMode = item.taxType === 'Inclusive' ? PRICING_MODE.INCLUSIVE : PRICING_MODE.EXCLUSIVE;

    const grossAmountDec = Money.round(unitPriceDec.times(quantityDec));

    if (discountDec.greaterThan(grossAmountDec)) {
      throw new AppError(`Discount (${discount}) cannot be greater than gross amount (${grossAmountDec.toFixed(2)}) for item ${item.name}`, 400);
    }

    const amountAfterDiscountDec = grossAmountDec.minus(discountDec);

    // Fetch tax config if item has HSN/SAC
    let taxTreatment = TAX_TREATMENT.TAXABLE; // Default assumption if no config implies taxable, but wait, Phase 8 says:
    // "If required tax configuration is missing for a taxable item... return a clear validation error"
    let gstRate = 0;
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let classificationType = item.type === 'Service' ? 'SAC' : 'HSN'; // Fallback matching item type

    if (item.hsnSac) {
      const taxConfig = taxConfigMap.get(item.hsnSac);
      if (!taxConfig) {
        throw new AppError(`Tax configuration missing for HSN/SAC ${item.hsnSac} (Item: ${item.name})`, 400);
      }

      taxTreatment = taxConfig.taxTreatment;
      gstRate = taxConfig.gstRate;
      classificationType = taxConfig.classificationType;

      if (taxTreatment === TAX_TREATMENT.TAXABLE) {
        if (supplyType === 'INTRA_STATE') {
          cgstRate = gstRate / 2;
          sgstRate = gstRate / 2;
        } else {
          igstRate = gstRate;
        }
      }
    } else {
      // If no HSN/SAC provided on item, we assume 0% Non-GST or require it.
      // Safe fallback for items without GST configuration is NON_GST or 0% EXEMPT.
      // Let's assume NON_GST for items not configured for tax.
      taxTreatment = TAX_TREATMENT.NON_GST;
      gstRate = 0;
    }

    // Phase 8 Engine Calculation
    const taxCalculation = calculateGST({
      amount: amountAfterDiscountDec.toFixed(2),
      gstRate,
      pricingMode,
      supplyType,
      taxTreatment
    });

    itemsSnapshot.push({
      itemId: item._id || null,
      type: item.type,
      name: item.name,
      description: item.description,
      sku: item.sku,
      hsnSac: item.hsnSac,
      classificationType,
      taxTreatment,
      quantity: payloadItem.quantity,
      unit: item.unit,
      unitPrice: unitPriceDec.toFixed(2),
      pricingMode,
      gstRate,
      cgstRate,
      sgstRate,
      igstRate,
      discount: discountDec.toFixed(2),
      taxableValue: taxCalculation.taxableAmount,
      cgst: taxCalculation.cgst,
      sgst: taxCalculation.sgst,
      igst: taxCalculation.igst,
      taxAmount: taxCalculation.totalGST,
      lineTotal: taxCalculation.total
    });

    // Aggregate totals
    subTotal = subTotal.plus(grossAmountDec);
    discountTotal = discountTotal.plus(discountDec);
    taxableTotal = taxableTotal.plus(new Decimal(taxCalculation.taxableAmount));
    cgstTotal = cgstTotal.plus(new Decimal(taxCalculation.cgst));
    sgstTotal = sgstTotal.plus(new Decimal(taxCalculation.sgst));
    igstTotal = igstTotal.plus(new Decimal(taxCalculation.igst));
    taxTotal = taxTotal.plus(new Decimal(taxCalculation.totalGST));
    grandTotal = grandTotal.plus(new Decimal(taxCalculation.total));
  }

  // Rule 46 compliance evaluation for unregistered recipients
  const rule46 = evaluateRule46Compliance({
    billingMode,
    customerSnapshot,
    placeOfSupply: posResult.placeOfSupply,
    placeOfSupplyStateCode: posResult.placeOfSupplyStateCode,
    taxableTotal
  });

  // Ensure balance calculation
  const paymentStatus = {
    paidAmount: '0.00',
    balanceDue: grandTotal.toFixed(2)
  };

  return {
    billingMode,
    placeOfSupply: posResult.placeOfSupply,
    placeOfSupplyStateCode: posResult.placeOfSupplyStateCode,
    supplyType,
    taxDecision: {
      placeOfSupply: posResult.placeOfSupply,
      placeOfSupplyStateCode: posResult.placeOfSupplyStateCode,
      supplyType,
      isFallback: posResult.isFallback,
      explanation: posResult.explanation,
      rule46
    },
    customerSnapshot,
    businessSnapshot: {
      name: business.name,
      ownerName: business.ownerName || '',
      tagline: business.tagline || '',
      gstin: business.gstin || '',
      pan: business.pan || '',
      address: business.address || '',
      city: business.city || '',
      state: business.state || '',
      pinCode: business.pinCode || '',
      country: business.country || 'India',
      phone: business.phone || '',
      alternatePhone: business.alternatePhone || '',
      email: business.email || '',
      website: business.website || '',
      logoUrl: business.logoUrl || '',
      bankDetails: {
        bankName: business.bankDetails?.bankName || '',
        accountNumber: business.bankDetails?.accountNumber || '',
        ifsc: business.bankDetails?.ifsc || '',
        branchName: business.bankDetails?.branchName || '',
        accountName: business.bankDetails?.accountName || ''
      },
      signature: {
        url: business.signature?.url || '',
        signerName: business.signature?.signerName || business.ownerName || business.name || '',
        designation: business.signature?.designation || 'Authorized Signatory'
      },
      seal: {
        url: business.seal?.url || ''
      }
    },
    items: itemsSnapshot,
    summary: {
      subTotal: subTotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      taxableTotal: taxableTotal.toFixed(2),
      cgstTotal: cgstTotal.toFixed(2),
      sgstTotal: sgstTotal.toFixed(2),
      igstTotal: igstTotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      grandTotal: grandTotal.toFixed(2)
    },
    paymentStatus
  };
};

/**
 * Creates a new DRAFT invoice
 */
const createDraftInvoice = async (businessId, payload) => {
  const {
    billingMode: inputBillingMode,
    customerId: inputCustomerId,
    quickCustomer,
    placeOfSupply,
    deliveryAddress,
    deliveryState,
    showPhoneOnInvoice,
    date,
    dueDate,
    notes,
    terms,
    items: itemsPayload
  } = payload;

  const billingMode = inputBillingMode || null;

  if (billingMode === 'GST-Registered' && !inputCustomerId) {
    throw new AppError('A registered customer profile must be selected in GST-Registered mode.', 400);
  }

  let effectiveCustomerId = inputCustomerId || null;
  let newlyCreatedCustomerId = null;

  try {
    // If General mode and quick customer details are provided (name or phone),
    // automatically persist / reuse the customer record through customerService.
    if ((billingMode === 'General' || !billingMode) && !effectiveCustomerId && quickCustomer && (quickCustomer.name || quickCustomer.phone)) {
      const persistedCustomer = await customerService.findOrCreateGeneralCustomer(businessId, quickCustomer);
      effectiveCustomerId = persistedCustomer._id;
      if (persistedCustomer._isNewGeneralCustomer) {
        newlyCreatedCustomerId = persistedCustomer._id;
      }
    }

    const calcOptions = {
      customerId: effectiveCustomerId,
      billingMode,
      quickCustomer,
      placeOfSupply,
      deliveryState,
      showPhoneOnInvoice: showPhoneOnInvoice !== undefined ? showPhoneOnInvoice : quickCustomer?.showPhoneOnInvoice
    };

    const calculatedData = await calculateInvoice(businessId, calcOptions, itemsPayload);

    if (effectiveCustomerId && calculatedData.customerSnapshot && calculatedData.customerSnapshot.customerId !== null) {
      calculatedData.customerSnapshot.customerId = effectiveCustomerId;
    }

    // We assign a temporary string for invoiceNumber since it is required by schema.
    // It will be overwritten upon finalization.
    // Draft prefix to ensure it doesn't conflict with finalized sequence.
    const tempInvoiceNumber = `DRAFT-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;

    const initialHash = generateDocumentIntegrityHash({
      businessId,
      invoiceNumber: tempInvoiceNumber,
      date,
      summary: calculatedData.summary,
      items: calculatedData.items
    });
    const authCodes = createVerificationCodes(initialHash, date);
    const signerName = calculatedData.businessSnapshot.signature?.signerName || business.ownerName || business.name || 'Authorized Signatory';
    const signerDesignation = calculatedData.businessSnapshot.signature?.designation || 'Authorized Signatory';

    const invoice = new Invoice({
      businessId,
      invoiceNumber: tempInvoiceNumber,
      date,
      dueDate,
      status: 'Draft',
      billingMode: calculatedData.billingMode,
      placeOfSupply: calculatedData.placeOfSupply,
      placeOfSupplyStateCode: calculatedData.placeOfSupplyStateCode,
      customerSnapshot: calculatedData.customerSnapshot,
      showPhoneOnInvoice: Boolean(calculatedData.customerSnapshot?.showPhoneOnInvoice),
      businessSnapshot: calculatedData.businessSnapshot,
      items: calculatedData.items,
      summary: calculatedData.summary,
      paymentStatus: calculatedData.paymentStatus,
      digitalSignature: {
        isSigned: true,
        signedBy: signerName,
        designation: signerDesignation,
        signedAt: new Date(),
        verificationCode: authCodes.verificationCode,
        documentHash: initialHash,
        auditId: authCodes.auditId
      },
      auditTrail: [{
        action: 'CREATED_AND_SIGNED',
        description: 'Invoice registered and cryptographically signed with SHA-256 seal',
        performedBy: signerName,
        timestamp: new Date(),
        documentHash: initialHash
      }],
      notes,
      terms
    });

    await invoice.save();
    return invoice;
  } catch (err) {
    // Transactional consistency guarantee:
    // If draft invoice creation fails, do not leave an orphaned quick customer created in this transaction
    if (newlyCreatedCustomerId) {
      await Customer.deleteOne({ _id: newlyCreatedCustomerId, businessId }).catch(() => {});
    }
    throw err;
  }
};

/**
 * Updates an existing DRAFT invoice
 */
const updateDraftInvoice = async (businessId, invoiceId, payload) => {
  const invoice = await Invoice.findOne({ _id: invoiceId, businessId });
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status !== 'Draft') throw new AppError('Only Draft invoices can be updated', 400);

  const billingMode = payload.billingMode || invoice.billingMode || 'General';
  let customerId = payload.customerId !== undefined ? payload.customerId : invoice.customerSnapshot?.customerId;
  const quickCustomer = payload.quickCustomer || null;
  const placeOfSupply = payload.placeOfSupply || invoice.placeOfSupply;
  const deliveryState = payload.deliveryState || null;
  const showPhoneOnInvoice = payload.showPhoneOnInvoice !== undefined
    ? payload.showPhoneOnInvoice
    : (quickCustomer?.showPhoneOnInvoice !== undefined ? quickCustomer.showPhoneOnInvoice : invoice.showPhoneOnInvoice);

  if (billingMode === 'General' && !customerId && quickCustomer && (quickCustomer.name || quickCustomer.phone)) {
    const persistedCustomer = await customerService.findOrCreateGeneralCustomer(businessId, quickCustomer);
    customerId = persistedCustomer._id;
  }

  let calculatedData = null;

  // If items changed or customer changed or mode changed, recalculate.
  const itemsToCalculate = payload.items && payload.items.length > 0 ? payload.items : invoice.items;
  if (itemsToCalculate && itemsToCalculate.length > 0) {
    calculatedData = await calculateInvoice(businessId, {
      customerId,
      billingMode,
      quickCustomer,
      placeOfSupply,
      deliveryState,
      showPhoneOnInvoice
    }, itemsToCalculate);
  }

  if (calculatedData) {
    if (customerId && calculatedData.customerSnapshot && calculatedData.customerSnapshot.customerId !== null) {
      calculatedData.customerSnapshot.customerId = customerId;
    }
    invoice.billingMode = billingMode;
    invoice.placeOfSupply = calculatedData.placeOfSupply;
    invoice.placeOfSupplyStateCode = calculatedData.placeOfSupplyStateCode;
    invoice.customerSnapshot = calculatedData.customerSnapshot;
    invoice.showPhoneOnInvoice = Boolean(calculatedData.customerSnapshot?.showPhoneOnInvoice);
    invoice.businessSnapshot = calculatedData.businessSnapshot;
    invoice.items = calculatedData.items;
    invoice.summary = calculatedData.summary;
    invoice.paymentStatus = calculatedData.paymentStatus;
  } else if (payload.showPhoneOnInvoice !== undefined) {
    invoice.showPhoneOnInvoice = Boolean(payload.showPhoneOnInvoice);
    if (invoice.customerSnapshot) {
      invoice.customerSnapshot.showPhoneOnInvoice = Boolean(payload.showPhoneOnInvoice);
    }
  }

  if (payload.date) invoice.date = payload.date;
  if (payload.dueDate !== undefined) invoice.dueDate = payload.dueDate;
  if (payload.notes !== undefined) invoice.notes = payload.notes;
  if (payload.terms !== undefined) invoice.terms = payload.terms;

  await invoice.save();
  return invoice;
};

/**
 * Finalizes a DRAFT invoice.
 * Generates an atomic invoice number and locks the financial document.
 * Returns the invoice if already FINALIZED.
 */
const finalizeInvoice = async (businessId, invoiceId) => {
  const business = await Business.findById(businessId);
  if (!business) throw new AppError('Business not found', 404);

  const prefix = business.invoiceSettings?.prefix || 'INV-';

  // Find invoice
  let invoice = await Invoice.findOne({ _id: invoiceId, businessId });
  if (!invoice) throw new AppError('Invoice not found', 404);

  // Idempotency: If already finalized, just return it (NO duplicate stock deduction)
  if (invoice.status === 'Unpaid' || invoice.status === 'Paid' || invoice.status === 'Partially Paid') {
    return invoice;
  }

  if (invoice.status !== 'Draft') {
    throw new AppError(`Cannot finalize invoice in status: ${invoice.status}`, 400);
  }

  // Rule 46 Verification before finalization:
  // For taxable supply of goods >= ₹50,000 to an unregistered recipient, mandatory recipient details must be recorded.
  const rule46Check = evaluateRule46Compliance({
    billingMode: invoice.billingMode,
    customerSnapshot: invoice.customerSnapshot,
    placeOfSupply: invoice.placeOfSupply,
    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
    taxableTotal: invoice.summary?.taxableTotal
  });

  if (rule46Check.isApplicable && rule46Check.thresholdExceeded && !rule46Check.compliant) {
    throw new AppError(
      `Under GST Rule 46, for an unregistered recipient where taxable supply value is ₹${rule46Check.taxableTotal} (>= ₹50,000), the invoice must contain the recipient name, address, and delivery state with state code. Missing: ${rule46Check.missingFields.join(', ')}.`,
      400
    );
  }

  // Use a transaction for atomic finalization + stock deduction
  const inventoryService = require('./inventory.service');
  const session = await mongoose.startSession();
  try {
    let finalizedInvoice;
    await session.withTransaction(async () => {
      // 0. Auto-create catalogue items for any ad-hoc line items
      let itemsModified = false;
      for (const lineItem of invoice.items) {
        if (!lineItem.itemId) {
          const trimmedName = (lineItem.name || '').trim();
          let targetItem = await Item.findOne({
            businessId,
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
          }).session(session);

          const isProduct = lineItem.type === 'Product';
          // Ensure unit price is stored as the price of 1 item
          const unitPriceDecimal = Money.toDecimal128(lineItem.unitPrice);

          if (!targetItem) {
            const [createdItem] = await Item.create([{
              businessId,
              name: trimmedName,
              type: lineItem.type || 'Product',
              unitPrice: unitPriceDecimal,
              taxType: 'Exclusive',
              currentStock: isProduct ? roundQty(lineItem.quantity) : null,
              lowStockThreshold: isProduct ? 5 : null,
              isActive: true
            }], { session });
            targetItem = createdItem;
          } else if (isProduct && (targetItem.currentStock === null || targetItem.currentStock < roundQty(lineItem.quantity))) {
            const neededStock = roundQty(lineItem.quantity);
            await Item.updateOne(
              { _id: targetItem._id, businessId },
              { $set: { currentStock: neededStock } },
              { session }
            );
          }

          lineItem.itemId = targetItem._id;
          itemsModified = true;
        }
      }

      // 1. Allocate sequence number atomically
      const counterResult = await Counter.findOneAndUpdate(
        { businessId },
        { $inc: { sequenceValue: 1 } },
        { upsert: true, returnDocument: 'after', session }
      );

      const seqStr = String(counterResult.sequenceValue).padStart(4, '0');
      const finalInvoiceNumber = `${prefix}${seqStr}`;

      const finalHash = generateDocumentIntegrityHash({
        businessId,
        invoiceNumber: finalInvoiceNumber,
        date: invoice.date,
        summary: invoice.summary,
        items: invoice.items
      });
      const finalAuthCodes = createVerificationCodes(finalHash, invoice.date);
      const finalSigner = invoice.businessSnapshot?.signature?.signerName || invoice.businessSnapshot?.ownerName || business.name || 'Authorized Signatory';

      // 2. Update the invoice atomically (guarding against concurrent finalizations)
      const updateFields = {
        status: 'Unpaid',
        invoiceNumber: finalInvoiceNumber,
        'digitalSignature.documentHash': finalHash,
        'digitalSignature.verificationCode': finalAuthCodes.verificationCode,
        'digitalSignature.auditId': finalAuthCodes.auditId,
        'digitalSignature.signedAt': new Date()
      };
      if (itemsModified) {
        updateFields.items = invoice.items;
      }

      const updateResult = await Invoice.findOneAndUpdate(
        { _id: invoiceId, businessId, status: 'Draft' }, // Crucial guard condition
        {
          $set: updateFields,
          $push: {
            auditTrail: {
              action: 'FINALIZED_AND_ISSUED',
              description: `Tax Invoice finalized and issued with official number ${finalInvoiceNumber}`,
              performedBy: finalSigner,
              timestamp: new Date(),
              documentHash: finalHash
            }
          }
        },
        { returnDocument: 'after', session }
      );

      if (!updateResult) {
        // Another thread finalized it — fetch the current state
        finalizedInvoice = await Invoice.findOne({ _id: invoiceId, businessId }).session(session);
        return;
      }

      // 3. Deduct stock for Product line items
      await inventoryService.deductStockForInvoice(businessId, updateResult, session);

      finalizedInvoice = updateResult;
    });

    return finalizedInvoice;
  } finally {
    session.endSession();
  }
};

module.exports = {
  getInvoices,
  calculateInvoice,
  createDraftInvoice,
  updateDraftInvoice,
  finalizeInvoice
};
