const reportService = require('../services/report.service');

const getSalesReport = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { startDate, endDate } = req.query;

    const data = await reportService.getSalesReport(businessId, startDate, endDate);

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getGSTSummary = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { startDate, endDate } = req.query;

    const data = await reportService.getGSTSummary(businessId, startDate, endDate);

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getGSTRateWise = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { startDate, endDate } = req.query;

    const data = await reportService.getGSTRateWise(businessId, startDate, endDate);

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getGSTHSNWise = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const result = await reportService.getGSTHSNWise(businessId, startDate, endDate, page, limit);

    res.status(200).json({
      status: 'success',
      ...result // This will spread data and pagination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSalesReport,
  getGSTSummary,
  getGSTRateWise,
  getGSTHSNWise
};
