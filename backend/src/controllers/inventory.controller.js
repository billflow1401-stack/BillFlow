const inventoryService = require('../services/inventory.service');
const AppError = require('../utils/AppError');

/**
 * List all product inventory for the authenticated business.
 */
const getInventoryList = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const inventory = await inventoryService.getInventoryList(businessId);

    res.status(200).json({
      status: 'success',
      results: inventory.length,
      data: { inventory }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single product inventory details.
 */
const getItemInventory = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { itemId } = req.params;
    const item = await inventoryService.getItemInventory(businessId, itemId);

    res.status(200).json({
      status: 'success',
      data: { item }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stock In — add stock to a product.
 */
const stockIn = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { itemId } = req.params;
    const { quantity, note } = req.body;

    const result = await inventoryService.stockIn(businessId, itemId, quantity, note);

    res.status(200).json({
      status: 'success',
      data: { result }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stock Adjustment — set stock to a physical count value.
 */
const adjust = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { itemId } = req.params;
    const { newStock, note } = req.body;

    const result = await inventoryService.stockAdjust(businessId, itemId, newStock, note);

    res.status(200).json({
      status: 'success',
      data: { result }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get movement history for a product.
 */
const getMovements = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { itemId } = req.params;
    const movements = await inventoryService.getMovements(businessId, itemId);

    res.status(200).json({
      status: 'success',
      results: movements.length,
      data: { movements }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventoryList,
  getItemInventory,
  stockIn,
  adjust,
  getMovements
};
