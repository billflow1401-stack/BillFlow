const paymentService = require('../services/payment.service');
const AppError = require('../utils/AppError');

/**
 * Record a payment against an invoice
 */
const recordPayment = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { invoiceId } = req.params;
    const paymentData = req.body;
    
    // Extract idempotency key
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      throw new AppError('X-Idempotency-Key header is required, must be a string, and cannot exceed 100 characters', 400);
    }

    // Only allow alphanumeric and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(idempotencyKey)) {
      throw new AppError('X-Idempotency-Key contains invalid characters', 400);
    }

    const { payment, invoice, isDuplicate } = await paymentService.recordPayment(businessId, invoiceId, paymentData, idempotencyKey);
    
    const statusCode = isDuplicate ? 200 : 201;

    res.status(statusCode).json({
      status: 'success',
      data: {
        payment,
        invoice
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payments for an invoice
 */
const getPaymentsForInvoice = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const { invoiceId } = req.params;
    
    const payments = await paymentService.getPaymentsForInvoice(businessId, invoiceId);
    
    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: {
        payments
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordPayment,
  getPaymentsForInvoice
};
