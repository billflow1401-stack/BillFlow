const Item = require('../models/Item');
const TaxConfig = require('../models/TaxConfig');
const AppError = require('../utils/AppError');

/**
 * Get all items for the authenticated business.
 */
const getItems = async (businessId, query = {}) => {
  const { page = 1, limit = 20, search, type, isActive, sort = 'createdAt', order = 'desc' } = query;
  
  const filter = { businessId };
  
  if (type) {
    filter.type = type;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  
  if (search) {
    const escapedSearch = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { sku: { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  const sortDirection = order === 'asc' ? 1 : -1;
  const sortObj = { [sort]: sortDirection, _id: -1 };

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Item.find(filter).populate('taxConfigId').sort(sortObj).skip(skip).limit(limit),
    Item.countDocuments(filter)
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
 * Get a single item by ID, ensuring it belongs to the business.
 */
const getItemById = async (businessId, itemId) => {
  const item = await Item.findOne({ _id: itemId, businessId }).populate('taxConfigId');
  if (!item) {
    throw new AppError('Item not found', 404);
  }
  return item;
};

/**
 * Create a new item for the authenticated business.
 */
const createItem = async (businessId, data) => {
  delete data.businessId;
  delete data._id;
  
  // Enforce Service rules before creation
  if (data.type === 'Service') {
    data.currentStock = null;
    data.lowStockThreshold = null;
    data.costPrice = null;
  }

  if (data.taxConfigId) {
    const taxConfig = await TaxConfig.findOne({ _id: data.taxConfigId, businessId });
    if (!taxConfig) {
      throw new AppError('Tax configuration not found or does not belong to business', 400);
    }
    const expectedType = data.type === 'Service' ? 'SAC' : 'HSN';
    if (taxConfig.isOfficialReference && taxConfig.classificationType !== expectedType) {
      throw new AppError(`Classification type mismatch: Item is a ${data.type} but tax configuration is ${taxConfig.classificationType}`, 400);
    }
    data.hsnSac = taxConfig.hsnSac;
  }

  const item = await Item.create({
    ...data,
    businessId // Server-derived, never trust client
  });
  return item;
};

/**
 * Update an item, ensuring it belongs to the business.
 */
const updateItem = async (businessId, itemId, updateData) => {
  // Strip protected fields
  delete updateData._id;
  delete updateData.businessId;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  // Determine the effective type: either from the update or from the existing record
  let effectiveType = updateData.type;
  if (!effectiveType) {
    const existing = await Item.findOne({ _id: itemId, businessId });
    if (!existing) {
      throw new AppError('Item not found', 404);
    }
    effectiveType = existing.type;
  }

  // Enforce Service rules
  if (effectiveType === 'Service') {
    updateData.currentStock = null;
    updateData.lowStockThreshold = null;
    updateData.costPrice = null;
  }

  if (updateData.taxConfigId) {
    const taxConfig = await TaxConfig.findOne({ _id: updateData.taxConfigId, businessId });
    if (!taxConfig) {
      throw new AppError('Tax configuration not found or does not belong to business', 400);
    }
    const expectedType = effectiveType === 'Service' ? 'SAC' : 'HSN';
    if (taxConfig.isOfficialReference && taxConfig.classificationType !== expectedType) {
      throw new AppError(`Classification type mismatch: Item is a ${effectiveType} but tax configuration is ${taxConfig.classificationType}`, 400);
    }
    updateData.hsnSac = taxConfig.hsnSac;
  }

  const item = await Item.findOneAndUpdate(
    { _id: itemId, businessId },
    { $set: updateData },
    { returnDocument: 'after', runValidators: true }
  );

  if (!item) {
    throw new AppError('Item not found', 404);
  }
  return item;
};

/**
 * Delete an item, ensuring it belongs to the business.
 */
const deleteItem = async (businessId, itemId) => {
  const item = await Item.findOneAndDelete({ _id: itemId, businessId });
  if (!item) {
    throw new AppError('Item not found', 404);
  }
  return item;
};

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem
};
