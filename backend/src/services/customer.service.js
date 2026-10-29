const Customer = require('../models/Customer');
const AppError = require('../utils/AppError');
const { isGstinStateMatching } = require('../utils/gstStateCodes');

/**
 * Get all customers for the authenticated business.
 */
const getCustomers = async (businessId, query = {}) => {
  const { page = 1, limit = 20, search, customerType, gstStatus, sort = 'createdAt', order = 'desc' } = query;

  const filter = {
    businessId,
    isSystemWalkIn: { $ne: true } // Exclude reserved system walk-in profiles from ordinary lists
  };

  if (customerType) {
    filter.customerType = customerType;
  }

  if (gstStatus) {
    const gstStatusCondition = gstStatus === 'Registered'
      ? { $or: [{ gstStatus: 'Registered' }, { gstStatus: { $exists: false }, gstin: { $exists: true, $ne: '' } }] }
      : { $or: [{ gstStatus: 'Unregistered' }, { gstStatus: { $exists: false }, $or: [{ gstin: { $exists: false } }, { gstin: null }, { gstin: '' }] }] };

    if (filter.$and) {
      filter.$and.push(gstStatusCondition);
    } else {
      filter.$and = [gstStatusCondition];
    }
  }

  if (search) {
    const escapedSearch = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const digitsOnly = search.replace(/\D/g, '');
    const searchConditions = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
      { phone: { $regex: escapedSearch, $options: 'i' } },
      { gstin: { $regex: escapedSearch, $options: 'i' } }
    ];
    if (digitsOnly.length >= 3) {
      searchConditions.push({ normalizedPhone: { $regex: digitsOnly } });
    }
    if (filter.$and) {
      filter.$and.push({ $or: searchConditions });
    } else {
      filter.$or = searchConditions;
    }
  }

  const sortDirection = order === 'asc' ? 1 : -1;
  const sortObj = { [sort]: sortDirection, _id: -1 };

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Customer.find(filter).sort(sortObj).skip(skip).limit(limit),
    Customer.countDocuments(filter)
  ]);

  const mappedData = data.map(c => {
    const obj = c.toObject ? c.toObject() : { ...c };
    if (!obj.gstStatus) {
      obj.gstStatus = (obj.gstin && /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(obj.gstin))
        ? 'Registered'
        : 'Unregistered';
    }
    return obj;
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data: mappedData,
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
 * Get a single customer by ID, ensuring it belongs to the business.
 */
const getCustomerById = async (businessId, customerId) => {
  const customer = await Customer.findOne({ _id: customerId, businessId, isSystemWalkIn: { $ne: true } });
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  return customer;
};

/**
 * Create a new customer for the authenticated business.
 */
const createCustomer = async (businessId, data) => {
  delete data.businessId;
  delete data._id;

  if (data.phone) {
    data.normalizedPhone = Customer.normalizePhone(data.phone);
  }

  if (data.gstStatus === 'Registered') {
    if (!data.gstin || !data.gstin.trim()) {
      throw new AppError('GSTIN is required when GST status is Registered', 400);
    }
    if (data.state && !isGstinStateMatching(data.gstin, data.state)) {
      throw new AppError('GSTIN state code (first 2 digits) does not match the provided state', 400);
    }
  }

  const customer = await Customer.create({
    ...data,
    businessId // Override any client-provided businessId
  });
  return customer;
};

/**
 * Update a customer, ensuring it belongs to the business.
 */
const updateCustomer = async (businessId, customerId, updateData) => {
  // Strip protected fields
  delete updateData._id;
  delete updateData.businessId;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  if (updateData.phone !== undefined) {
    updateData.normalizedPhone = Customer.normalizePhone(updateData.phone);
  }

  if (updateData.gstStatus === 'Registered') {
    const existing = await Customer.findOne({ _id: customerId, businessId });
    if (!existing) throw new AppError('Customer not found', 404);
    const finalGstin = updateData.gstin !== undefined ? updateData.gstin : existing.gstin;
    const finalState = updateData.state !== undefined ? updateData.state : existing.state;
    if (!finalGstin || !finalGstin.trim()) {
      throw new AppError('GSTIN is required when GST status is Registered', 400);
    }
    if (finalState && !isGstinStateMatching(finalGstin, finalState)) {
      throw new AppError('GSTIN state code (first 2 digits) does not match the provided state', 400);
    }
  }

  const customer = await Customer.findOneAndUpdate(
    { _id: customerId, businessId },
    { $set: updateData },
    { returnDocument: 'after', runValidators: true }
  );

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  return customer;
};

/**
 * Finds an existing general customer by normalized mobile or creates a new one.
 * Strictly scoped to businessId.
 * Guarantees that existing Registered profiles are never silently downgraded.
 */
const findOrCreateGeneralCustomer = async (businessId, customerData, session = null) => {
  const { name, phone, email, billingAddress, address, city, state, pinCode, country, notes } = customerData;
  const effectiveAddress = (billingAddress || address);
  const normalizedPhone = phone ? Customer.normalizePhone(phone) : null;

  if (normalizedPhone) {
    const query = {
      businessId,
      normalizedPhone,
      isSystemWalkIn: { $ne: true }
    };
    const existingCustomer = session
      ? await Customer.findOne(query).session(session)
      : await Customer.findOne(query);

    if (existingCustomer) {
      const isRegistered = existingCustomer.gstStatus === 'Registered' || Boolean(existingCustomer.gstin);
      if (isRegistered) {
        // Matched an existing GST-Registered customer profile in General mode.
        // To maintain strict recipient consistency and prevent falsely representing the registered
        // profile as unregistered, we do NOT link this General counter invoice to the registered profile.
        // We preserve the registered profile completely, create no duplicate profile, and return
        // an unlinked counter recipient representation (_id: null).
        return {
          _id: null,
          name: (name && name.trim()) || existingCustomer.name,
          customerType: 'Individual',
          gstStatus: 'Unregistered',
          phone: phone || existingCustomer.phone,
          normalizedPhone,
          billingAddress: effectiveAddress || existingCustomer.billingAddress,
          city: city || existingCustomer.city,
          state: state || existingCustomer.state,
          country: country || existingCustomer.country || 'India',
          isMatchedRegistered: true,
          matchedRegisteredCustomerId: existingCustomer._id,
          _isNewGeneralCustomer: false
        };
      }

      // Reusing existing unregistered customer record without altering its profile
      existingCustomer._isNewGeneralCustomer = false;
      return existingCustomer;
    }
  }

  // If only name provided or phone not found: create a new unregistered customer
  const customerToCreate = {
    businessId,
    name: (name && name.trim()) || 'Walk-in Customer',
    customerType: customerData.customerType || 'Individual',
    gstStatus: 'Unregistered',
    phone: phone ? phone.trim() : undefined,
    normalizedPhone: normalizedPhone || undefined,
    email: email ? email.trim() : undefined,
    billingAddress: effectiveAddress ? effectiveAddress.trim() : undefined,
    city: city ? city.trim() : undefined,
    state: state ? state.trim() : undefined,
    pinCode: pinCode ? pinCode.trim() : undefined,
    country: country ? country.trim() : 'India',
    notes: notes ? notes.trim() : undefined
  };

  const createOptions = session ? { session } : {};
  const [newCustomer] = await Customer.create([customerToCreate], createOptions);
  newCustomer._isNewGeneralCustomer = true;
  return newCustomer;
};

/**
 * Delete a customer, ensuring it belongs to the business.
 */
const deleteCustomer = async (businessId, customerId) => {
  const customer = await Customer.findOneAndDelete({ _id: customerId, businessId });
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  return customer;
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  findOrCreateGeneralCustomer,
  deleteCustomer
};
