const Business = require('../models/Business');
const AppError = require('../utils/AppError');

/**
 * Get the business profile for the authenticated user's business.
 */
const getBusinessProfile = async (businessId) => {
  const business = await Business.findById(businessId);
  if (!business) {
    throw new AppError('Business not found', 404);
  }
  return business;
};

/**
 * Update the business profile for the authenticated user's business.
 * Only allows updating safe, approved fields.
 */
const updateBusinessProfile = async (businessId, updateData) => {
  // Strip any system/protected fields that must never be client-overwritten
  delete updateData._id;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  const business = await Business.findByIdAndUpdate(
    businessId,
    { $set: updateData },
    { returnDocument: 'after', runValidators: true }
  );

  if (!business) {
    throw new AppError('Business not found', 404);
  }

  return business;
};

module.exports = { getBusinessProfile, updateBusinessProfile };
