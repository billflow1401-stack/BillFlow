const express = require('express');
const taxConfigController = require('../../controllers/taxConfig.controller');
const validateRequest = require('../../middleware/validateRequest');
const validateObjectId = require('../../middleware/validateObjectId');
const { createTaxConfigSchema, updateTaxConfigSchema, calculateTaxSchema, lookupQuerySchema } = require('../../validators/taxConfig.validator');
const { protect } = require('../../middleware/auth');

const router = express.Router();

// All tax routes require authentication
router.use(protect);

// Lookup must be defined BEFORE /:id to avoid route conflict
router.get('/lookup', validateRequest(lookupQuerySchema, 'query'), taxConfigController.lookup);

// Tax calculation endpoint (for testing/debugging)
router.post('/calculate', validateRequest(calculateTaxSchema), taxConfigController.calculateTax);

router.route('/')
  .get(taxConfigController.getTaxConfigs)
  .post(validateRequest(createTaxConfigSchema), taxConfigController.createTaxConfig);

router.route('/:id')
  .all(validateObjectId('id'))
  .get(taxConfigController.getTaxConfig)
  .patch(validateRequest(updateTaxConfigSchema), taxConfigController.updateTaxConfig)
  .delete(taxConfigController.deleteTaxConfig);

module.exports = router;
