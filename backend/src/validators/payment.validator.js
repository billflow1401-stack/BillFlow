const { z } = require('zod');
const Money = require('../utils/money');

const createPaymentSchema = z.object({
  amount: z.union([z.number(), z.string()], {
    required_error: 'Amount is required',
    invalid_type_error: 'Amount must be a number or string'
  })
    .refine(val => {
      const str = String(val).trim();
      return /^\d+(\.\d{1,2})?$/.test(str) && Number(str) >= 0;
    }, { message: 'Amount must be a non-negative monetary amount with at most 2 decimal places' })
    .transform(val => Money.parseInput(val, { fieldName: 'Amount' })),
  paymentDate: z.string().datetime('Invalid payment date'),
  method: z.enum(['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque', 'Settlement Discount']),
  referenceNumber: z.string().max(100, 'Reference number too long').optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
  isFinalSettlement: z.boolean().optional().default(false),
  settlementReason: z.string().max(250).optional(),
  settlementDiscount: z.union([z.number(), z.string()]).optional()
}).strict();

module.exports = {
  createPaymentSchema
};
