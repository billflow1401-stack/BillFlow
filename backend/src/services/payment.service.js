const mongoose = require('mongoose');
const Money = require('../utils/money');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const AppError = require('../utils/AppError');

/**
 * Record a payment securely with a MongoDB Transaction.
 *
 * @param {string} businessId
 * @param {string} invoiceId
 * @param {object} paymentData
 * @param {string} idempotencyKey
 */
const recordPayment = async (businessId, invoiceId, paymentData, idempotencyKey) => {
  const canonicalAmount = Money.parseInput(paymentData.amount, { fieldName: 'Payment amount' });
  const paymentAmountDecimal128 = Money.toDecimal128(canonicalAmount);

  const isFinal = Boolean(paymentData.isFinalSettlement);

  // If payment amount is 0, isFinal must be true (pure waiver/round-off settlement)
  if (Number(canonicalAmount) === 0 && !isFinal) {
    throw new AppError('Payment amount must be greater than zero unless marking as final settlement', 400);
  }

  // 1. Idempotency Check Before Transaction
  const existingPayment = await Payment.findOne({ businessId, idempotencyKey });
  if (existingPayment) {
    const isSame = String(existingPayment.amount) === canonicalAmount &&
                   new Date(existingPayment.paymentDate).getTime() === new Date(paymentData.paymentDate).getTime() &&
                   existingPayment.method === paymentData.method &&
                   Boolean(existingPayment.isFinalSettlement) === isFinal &&
                   (existingPayment.referenceNumber || '') === (paymentData.referenceNumber || '') &&
                   (existingPayment.notes || '') === (paymentData.notes || '');

    if (isSame) {
      const invoice = await Invoice.findById(existingPayment.invoiceId);
      return { payment: existingPayment, invoice, isDuplicate: true };
    } else {
      throw new AppError('Idempotency key reuse with different parameters is not allowed', 409);
    }
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Build update pipeline: standard vs full & final settlement
    const updatePipeline = isFinal
      ? [
          {
            $set: {
              'paymentStatus.paidAmount': { $add: ['$paymentStatus.paidAmount', paymentAmountDecimal128] },
              'paymentStatus.settlementDiscount': {
                $add: [
                  { $ifNull: ['$paymentStatus.settlementDiscount', Money.toDecimal128('0.00')] },
                  { $subtract: ['$paymentStatus.balanceDue', paymentAmountDecimal128] }
                ]
              },
              'paymentStatus.balanceDue': Money.toDecimal128('0.00'),
              'paymentStatus.isSettled': true,
              'paymentStatus.settlementNotes': paymentData.settlementReason || paymentData.notes || 'Full and final agreed settlement',
              status: 'Paid',
              auditTrail: {
                $concatArrays: [
                  { $ifNull: ['$auditTrail', []] },
                  [{
                    action: 'SETTLEMENT_PAYMENT',
                    description: `Payment of ₹${canonicalAmount} recorded with Full & Final agreed settlement discount`,
                    performedBy: 'Billing Department',
                    timestamp: new Date()
                  }]
                ]
              }
            }
          }
        ]
      : [
          {
            $set: {
              'paymentStatus.paidAmount': { $add: ['$paymentStatus.paidAmount', paymentAmountDecimal128] },
              'paymentStatus.balanceDue': { $subtract: ['$paymentStatus.balanceDue', paymentAmountDecimal128] }
            }
          },
          {
            $set: {
              status: {
                $cond: {
                  if: { $lte: ['$paymentStatus.balanceDue', Money.toDecimal128('0.00')] },
                  then: 'Paid',
                  else: 'Partially Paid'
                }
              },
              auditTrail: {
                $concatArrays: [
                  { $ifNull: ['$auditTrail', []] },
                  [{
                    action: 'PAYMENT_RECORDED',
                    description: `Payment of ₹${canonicalAmount} recorded via ${paymentData.method || 'Standard'}`,
                    performedBy: 'Billing Department',
                    timestamp: new Date()
                  }]
                ]
              }
            }
          }
        ];

    // 2. Atomically update the invoice ONLY IF balance is sufficient and status allows
    const updatedInvoice = await Invoice.findOneAndUpdate(
      {
        _id: invoiceId,
        businessId,
        'paymentStatus.balanceDue': { $gte: paymentAmountDecimal128 },
        status: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
      },
      updatePipeline,
      { session, returnDocument: 'after', runValidators: true, updatePipeline: true }
    );

    if (!updatedInvoice) {
      // Check if invoice exists at all to throw correct error
      const existingInvoice = await Invoice.findOne({ _id: invoiceId, businessId }).session(session);
      if (!existingInvoice) {
        throw new AppError('Invoice not found', 404);
      }
      if (['Draft', 'Paid'].includes(existingInvoice.status)) {
        throw new AppError(`Cannot record payment for a ${existingInvoice.status} invoice`, 400);
      }
      throw new AppError('Payment amount exceeds current outstanding balance', 400);
    }

    // 3. Create the Payment document
    const payment = new Payment({
      businessId,
      invoiceId,
      idempotencyKey,
      amount: paymentAmountDecimal128,
      paymentDate: paymentData.paymentDate,
      method: paymentData.method,
      referenceNumber: paymentData.referenceNumber,
      notes: paymentData.notes || (isFinal ? (paymentData.settlementReason || 'Full & Final Agreed Settlement') : undefined),
      isFinalSettlement: isFinal,
      settlementDiscount: isFinal ? updatedInvoice.paymentStatus.settlementDiscount : Money.toDecimal128('0.00')
    });

    await payment.save({ session });

    await session.commitTransaction();

    return { payment, invoice: updatedInvoice, isDuplicate: false };

  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      // Duplicate idempotencyKey hit the unique index concurrently
      throw new AppError('A payment request with this idempotency key was already processed or is currently processing', 409);
    }
    // Handle transient transaction errors cleanly (e.g. WriteConflict)
    if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) {
      throw new AppError('Concurrent payment processing conflict. Please retry.', 409);
    }
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get payment history for an invoice
 */
const getPaymentsForInvoice = async (businessId, invoiceId) => {
  // First ensure invoice exists and belongs to business
  const invoice = await Invoice.findOne({ _id: invoiceId, businessId }).select('_id');
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  const payments = await Payment.find({ businessId, invoiceId })
    .sort('-paymentDate -createdAt');

  return payments;
};

module.exports = {
  recordPayment,
  getPaymentsForInvoice
};
