const express = require('express');
const healthRoute = require('./health.route');
const authRoute = require('./auth.route');
const businessRoute = require('./business.route');
const customerRoute = require('./customer.route');
const itemRoute = require('./item.route');
const taxConfigRoute = require('./taxConfig.route');
const invoiceRoute = require('./invoice.route');
const inventoryRoute = require('./inventory.route');
const dashboardRoute = require('./dashboard.route');
const reportRoute = require('./report.route');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/business', businessRoute);
router.use('/customers', customerRoute);
router.use('/items', itemRoute);
router.use('/tax-config', taxConfigRoute);
router.use('/invoices', invoiceRoute);
router.use('/inventory', inventoryRoute);
router.use('/dashboard', dashboardRoute);
router.use('/reports', reportRoute);

module.exports = router;
