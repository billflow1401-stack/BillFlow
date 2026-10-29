const dashboardService = require('../services/dashboard.service');

/**
 * Get dashboard summary
 * @route GET /api/v1/dashboard/summary
 * @access Private
 */
const getSummary = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const summary = await dashboardService.getDashboardSummary(businessId);

    res.status(200).json({
      status: 'success',
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary
};
