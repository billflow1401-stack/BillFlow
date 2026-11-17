const referenceService = require('../services/reference.service');

const search = async (req, res, next) => {
  try {
    const { q, type, digits, limit } = req.query;
    const result = await referenceService.searchOfficialClassifications({ q, type, digits, limit });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getRules = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { type } = req.query;
    const result = await referenceService.getOfficialRulesByCode(code, type);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const confirm = async (req, res, next) => {
  try {
    const actorId = req.user.userId || req.user._id;
    const config = await referenceService.confirmTaxSelection(req.user.businessId, actorId, req.body);
    res.status(200).json({
      success: true,
      message: 'Tax configuration confirmed successfully',
      data: { taxConfig: config }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  search,
  getRules,
  confirm
};

