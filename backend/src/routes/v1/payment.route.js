const express = require('express');
const { protect } = require('../../middleware/auth');
const paymentController = require('../../controllers/payment.controller');
const validateRequest = require('../../middleware/validateRequest');
const { createPaymentSchema } = require('../../validators/payment.validator');

// Merge params to access :invoiceId from parent router
const router = express.Router({ mergeParams: true });

router.use(protect);

router.route('/')
  .get(paymentController.getPaymentsForInvoice)
  .post(validateRequest(createPaymentSchema), paymentController.recordPayment);

module.exports = router;
