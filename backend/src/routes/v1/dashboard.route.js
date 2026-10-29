const express = require('express');
const dashboardController = require('../../controllers/dashboard.controller');
const { protect } = require('../../middleware/auth');

const router = express.Router();

router.use(protect); // Ensure all routes are protected

router.route('/summary').get(dashboardController.getSummary);

module.exports = router;
