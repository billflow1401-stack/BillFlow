const taxConfigService = require('../services/taxConfig.service');
const gstCalculationService = require('../services/gstCalculation.service');

const getTaxConfigs = async (req, res, next) => {
  try {
    const configs = await taxConfigService.getTaxConfigs(req.user.businessId);
    res.status(200).json({
      success: true,
      data: { taxConfigs: configs }
    });
  } catch (error) {
    next(error);
  }
};

const getTaxConfig = async (req, res, next) => {
  try {
    const config = await taxConfigService.getTaxConfigById(req.user.businessId, req.params.id);
    res.status(200).json({
      success: true,
      data: { taxConfig: config }
    });
  } catch (error) {
    next(error);
  }
};

const createTaxConfig = async (req, res, next) => {
  try {
    const config = await taxConfigService.createTaxConfig(req.user.businessId, req.body);
    res.status(201).json({
      success: true,
      message: 'Tax configuration created successfully',
      data: { taxConfig: config }
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.hsnSac) {
      return res.status(409).json({
        success: false,
        message: 'A tax configuration with this HSN/SAC code already exists for your business'
      });
    }
    next(error);
  }
};

const updateTaxConfig = async (req, res, next) => {
  try {
    const config = await taxConfigService.updateTaxConfig(req.user.businessId, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Tax configuration updated successfully',
      data: { taxConfig: config }
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.hsnSac) {
      return res.status(409).json({
        success: false,
        message: 'A tax configuration with this HSN/SAC code already exists for your business'
      });
    }
    next(error);
  }
};

const deleteTaxConfig = async (req, res, next) => {
  try {
    await taxConfigService.deleteTaxConfig(req.user.businessId, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Tax configuration deleted successfully',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

const lookup = async (req, res, next) => {
  try {
    const { code, description } = req.query;
    let results = [];

    if (code) {
      results = await taxConfigService.lookupByCode(req.user.businessId, code);
    } else if (description) {
      results = await taxConfigService.lookupByDescription(req.user.businessId, description);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide either code or description query parameter'
      });
    }

    res.status(200).json({
      success: true,
      data: { results }
    });
  } catch (error) {
    next(error);
  }
};

const calculateTax = async (req, res, next) => {
  try {
    const result = gstCalculationService.calculateGST(req.body);
    res.status(200).json({
      success: true,
      data: { calculation: result }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTaxConfigs,
  getTaxConfig,
  createTaxConfig,
  updateTaxConfig,
  deleteTaxConfig,
  lookup,
  calculateTax
};
