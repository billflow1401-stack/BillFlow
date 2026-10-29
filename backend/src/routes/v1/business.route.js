const express = require('express');
const businessController = require('../../controllers/business.controller');
const validateRequest = require('../../middleware/validateRequest');
const { updateBusinessSchema } = require('../../validators/business.validator');
const { protect } = require('../../middleware/auth');

const router = express.Router();

// All business routes are protected
router.use(protect);

router.get('/profile', businessController.getProfile);
router.patch('/profile', validateRequest(updateBusinessSchema), businessController.updateProfile);

module.exports = router;
