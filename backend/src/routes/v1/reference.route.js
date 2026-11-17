const express = require('express');
const referenceController = require('../../controllers/reference.controller');
const validateRequest = require('../../middleware/validateRequest');
const { confirmTaxConfigSchema } = require('../../validators/taxConfig.validator');
const { protect } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/hsn-sac/search', referenceController.search);
router.get('/hsn-sac/rules/:code', referenceController.getRules);
router.post('/confirm', validateRequest(confirmTaxConfigSchema), referenceController.confirm);

module.exports = router;

