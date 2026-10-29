const businessService = require('../services/business.service');

const getProfile = async (req, res, next) => {
  try {
    const business = await businessService.getBusinessProfile(req.user.businessId);

    res.status(200).json({
      success: true,
      data: { business }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const business = await businessService.updateBusinessProfile(
      req.user.businessId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Business profile updated successfully',
      data: { business }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile };
