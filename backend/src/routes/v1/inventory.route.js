const express = require('express');
const { protect } = require('../../middleware/auth');
const inventoryController = require('../../controllers/inventory.controller');
const validateRequest = require('../../middleware/validateRequest');
const validateObjectId = require('../../middleware/validateObjectId');
const { stockInSchema, adjustSchema } = require('../../validators/inventory.validator');

const router = express.Router();

// All inventory routes require authentication
router.use(protect);

router.get('/', inventoryController.getInventoryList);

router.use('/:itemId', validateObjectId('itemId'));
router.get('/:itemId', inventoryController.getItemInventory);
router.post('/:itemId/stock-in', validateRequest(stockInSchema), inventoryController.stockIn);
router.post('/:itemId/adjust', validateRequest(adjustSchema), inventoryController.adjust);
router.get('/:itemId/movements', inventoryController.getMovements);

module.exports = router;
