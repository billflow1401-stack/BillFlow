const TaxConfig = require('../models/TaxConfig');
const AppError = require('../utils/AppError');

/**
 * Get all tax configurations for a business.
 */
const getTaxConfigs = async (businessId) => {
  return await TaxConfig.find({ businessId }).sort({ hsnSac: 1 });
};

/**
 * Get a single tax configuration by ID.
 */
const getTaxConfigById = async (businessId, configId) => {
  const config = await TaxConfig.findOne({ _id: configId, businessId });
  if (!config) {
    throw new AppError('Tax configuration not found', 404);
  }
  return config;
};

/**
 * Create a new tax configuration.
 */
const createTaxConfig = async (businessId, data) => {
  delete data.businessId;
  delete data._id;
  const config = await TaxConfig.create({
    ...data,
    businessId
  });
  return config;
};

/**
 * Update a tax configuration.
 */
const updateTaxConfig = async (businessId, configId, updateData) => {
  delete updateData._id;
  delete updateData.businessId;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  const config = await TaxConfig.findOneAndUpdate(
    { _id: configId, businessId },
    { $set: updateData },
    { returnDocument: 'after', runValidators: true }
  );

  if (!config) {
    throw new AppError('Tax configuration not found', 404);
  }
  return config;
};

/**
 * Delete a tax configuration.
 */
const deleteTaxConfig = async (businessId, configId) => {
  const config = await TaxConfig.findOneAndDelete({ _id: configId, businessId });
  if (!config) {
    throw new AppError('Tax configuration not found', 404);
  }
  return config;
};

/**
 * Lookup tax configurations by HSN/SAC code (prefix match).
 */
const lookupByCode = async (businessId, code) => {
  const escapedCode = code.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  return await TaxConfig.find({
    businessId,
    hsnSac: { $regex: `^${escapedCode}`, $options: 'i' },
    isActive: true
  }).sort({ hsnSac: 1 }).limit(20);
};

/**
 * Lookup tax configurations by description (partial match).
 */
const lookupByDescription = async (businessId, description) => {
  const escapedDescription = description.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  return await TaxConfig.find({
    businessId,
    description: { $regex: escapedDescription, $options: 'i' },
    isActive: true
  }).sort({ hsnSac: 1 }).limit(20);
};

module.exports = {
  getTaxConfigs,
  getTaxConfigById,
  createTaxConfig,
  updateTaxConfig,
  deleteTaxConfig,
  lookupByCode,
  lookupByDescription
};
