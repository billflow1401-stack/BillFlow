const express = require('express');
const { protect } = require('../../middleware/auth');
const invoiceController = require('../../controllers/invoice.controller');
const validateRequest = require('../../middleware/validateRequest');
const validateObjectId = require('../../middleware/validateObjectId');
const { createDraftInvoiceSchema, updateDraftInvoiceSchema, calculateInvoiceSchema, invoiceQuerySchema } = require('../../validators/invoice.validator');

const router = express.Router();

// Public verification endpoint (accessible without login for QR scan and public verify portal)
router.get('/public/verify/:code', invoiceController.publicVerify);

// All subsequent invoice routes require authentication
router.use(protect);

router.post('/calculate', validateRequest(calculateInvoiceSchema), invoiceController.calculatePreview);
router.get('/:id/pdf', validateObjectId('id'), invoiceController.downloadPdf);
router.post('/:id/finalize', validateObjectId('id'), invoiceController.finalize);

router.route('/')
  .get(validateRequest(invoiceQuerySchema, 'query'), invoiceController.getInvoices)
  .post(validateRequest(createDraftInvoiceSchema), invoiceController.createDraft);

router.route('/:id')
  .all(validateObjectId('id'))
  .get(invoiceController.getInvoiceById)
  .patch(validateRequest(updateDraftInvoiceSchema), invoiceController.updateDraft);

// Payment routes for a specific invoice
router.use('/:invoiceId/payments', validateObjectId('invoiceId'), require('./payment.route'));

module.exports = router;
