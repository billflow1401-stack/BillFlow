const { z } = require('zod');
const Money = require('../utils/money');

const createTaxConfigSchema = z.object({
  hsnSac: z.string().min(1, 'HSN/SAC code is required').max(20).regex(/^\d+$/, 'HSN/SAC code must be numeric'),
  classificationType: z.enum(['HSN', 'SAC'], { message: 'classificationType must be HSN or SAC' }),
  description: z.string().max(500).optional(),
  gstRate: z.number().min(0, 'GST rate cannot be negative').max(100, 'GST rate cannot exceed 100'),
  taxTreatment: z.enum(['TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST'], {
    message: 'taxTreatment must be TAXABLE, NIL_RATED, EXEMPT, or NON_GST'
  }).optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  sourceReference: z.string().max(200).optional(),
  isActive: z.boolean().optional()
}).strict();

const updateTaxConfigSchema = z.object({
  hsnSac: z.string().min(1).max(20).regex(/^\d+$/, 'HSN/SAC code must be numeric').optional(),
  classificationType: z.enum(['HSN', 'SAC'], { message: 'classificationType must be HSN or SAC' }).optional(),
  description: z.string().max(500).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  taxTreatment: z.enum(['TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST']).optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  sourceReference: z.string().max(200).optional(),
  isActive: z.boolean().optional()
}).strict();

const calculateTaxSchema = z.object({
  amount: z.union([z.number(), z.string()])
    .refine(val => {
      const str = String(val).trim();
      return /^\d+(\.\d{1,2})?$/.test(str);
    }, { message: 'Amount must be a valid non-negative monetary amount with at most 2 decimal places' })
    .transform(val => Money.parseInput(val, { fieldName: 'Amount' }))
    .optional(),
  amountPaise: z.any().optional(), // For migration/legacy payload flexibility
  gstRate: z.number().min(0).max(100),
  pricingMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE']),
  taxTreatment: z.enum(['TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST']).optional()
}).refine(data => data.amount !== undefined || data.amountPaise !== undefined, {
  message: 'Amount is required'
}).transform(data => {
  const finalAmount = data.amount !== undefined ? data.amount : Money.parseInput(data.amountPaise, { fieldName: 'Amount' });
  return {
    ...data,
    amount: finalAmount
  };
});

const lookupQuerySchema = z.object({
  code: z.string().max(20, 'Code too long').optional(),
  description: z.string().max(100, 'Description too long').optional()
}).refine(data => data.code || data.description, {
  message: "Provide either code or description query parameter"
});

module.exports = { createTaxConfigSchema, updateTaxConfigSchema, calculateTaxSchema, lookupQuerySchema };
