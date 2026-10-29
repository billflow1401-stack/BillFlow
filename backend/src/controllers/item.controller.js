const itemService = require('../services/item.service');

const getItems = async (req, res, next) => {
  try {
    const result = await itemService.getItems(req.user.businessId, req.validatedQuery || req.query);
    res.status(200).json({
      success: true,
      data: { 
        items: result.data,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

const getItem = async (req, res, next) => {
  try {
    const item = await itemService.getItemById(req.user.businessId, req.params.id);
    res.status(200).json({
      success: true,
      data: { item }
    });
  } catch (error) {
    next(error);
  }
};

const createItem = async (req, res, next) => {
  try {
    const item = await itemService.createItem(req.user.businessId, req.body);
    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: { item }
    });
  } catch (error) {
    // Handle duplicate SKU
    if (error.code === 11000 && error.keyPattern?.sku) {
      return res.status(409).json({
        success: false,
        message: 'An item with this SKU already exists in your business'
      });
    }
    next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await itemService.updateItem(req.user.businessId, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: { item }
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.sku) {
      return res.status(409).json({
        success: false,
        message: 'An item with this SKU already exists in your business'
      });
    }
    next(error);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    await itemService.deleteItem(req.user.businessId, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem
};
