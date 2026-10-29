const express = require('express');
const { protect } = require('../../middleware/auth');
const validateQuery = require('../../middleware/validateQuery');
const { dateRangeSchema, hsnPaginationSchema } = require('../../validators/report.validator');
const reportController = require('../../controllers/report.controller');

const router = express.Router();

// All report routes require authentication
router.use(protect);

router.get('/sales', validateQuery(dateRangeSchema), reportController.getSalesReport);
router.get('/gst/summary', validateQuery(dateRangeSchema), reportController.getGSTSummary);
router.get('/gst/rate-wise', validateQuery(dateRangeSchema), reportController.getGSTRateWise);
router.get('/gst/hsn-wise', validateQuery(hsnPaginationSchema), reportController.getGSTHSNWise);

module.exports = router;
