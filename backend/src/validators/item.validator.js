const { z } = require('zod');
const Decimal = require('decimal.js');
const Money = require('../utils/money');

const MAX_MONETARY_AMOUNT = new Decimal('999999999');

const monetaryInput = (fieldName, isOptional = false) => {
  return z.union([z.number(), z.string()], {
    required_error: `${fieldName} is required`,
    invalid_type_error: `${fieldName} must be a number or string`
  })
    .refine(val => {
      if (val === null || val === undefined || val === '') return isOptional;
      const str = String(val).trim();
      if (!/^\d+(\.\d{1,2})?$/.test(str)) return false;
      return new Decimal(str).lte(MAX_MONETARY_AMOUNT);
    }, { message: `${fieldName} must be a valid non-negative monetary amount with at most 2 decimal places and at most 999999999` })
    .transform(val => {
      if (val === null || val === undefined || val === '') return isOptional ? null : undefined;
      return Money.parseInput(val, { isOptional, fieldName });
    });
};

const optionalMonetaryInput = (fieldName) => {
  return z.union([z.number(), z.string()])
    .refine(val => {
      if (val === null || val === undefined || val === '') return true;
      const str = String(val).trim();
      if (!/^\d+(\.\d{1,2})?$/.test(str)) return false;
      return new Decimal(str).lte(MAX_MONETARY_AMOUNT);
    }, { message: `${fieldName} must be a valid non-negative monetary amount with at most 2 decimal places and at most 999999999` })
    .transform(val => {
      if (val === null || val === undefined || val === '') return null;
      return Money.parseInput(val, { isOptional: true, fieldName });
    })
    .nullable()
    .optional();
};

// Schema for POST (Create)
const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['Product', 'Service'], { message: 'Type must be Product or Service' }),
  description: z.string().max(1000).optional(),
  sku: z.string().max(50).optional().or(z.literal('')),
  unit: z.string().max(50).optional(),
  hsnSac: z.string().max(20).optional().or(z.literal('')),
  unitPrice: monetaryInput('Selling price', false),
  costPrice: optionalMonetaryInput('Cost price'),
  currentStock: z.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').max(9999999, 'Stock too large').nullable().optional(),
  lowStockThreshold: z.number().int('Threshold must be an integer').min(0, 'Threshold cannot be negative').max(9999999, 'Threshold too large').nullable().optional(),
  taxType: z.enum(['Inclusive', 'Exclusive']).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().max(2000).optional()
}).strict();

const updateItemSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(200).optional(),
  type: z.enum(['Product', 'Service'], { message: 'Type must be Product or Service' }).optional(),
  description: z.string().max(1000).optional(),
  sku: z.string().max(50).optional().or(z.literal('')),
  unit: z.string().max(50).optional(),
  hsnSac: z.string().max(20).optional().or(z.literal('')),
  unitPrice: monetaryInput('Selling price', true).optional(),
  costPrice: optionalMonetaryInput('Cost price'),
  currentStock: z.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').max(9999999, 'Stock too large').nullable().optional(),
  lowStockThreshold: z.number().int('Threshold must be an integer').min(0, 'Threshold cannot be negative').max(9999999, 'Threshold too large').nullable().optional(),
  taxType: z.enum(['Inclusive', 'Exclusive']).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().max(2000).optional()
}).strict();

// Schema for GET (List) query parameters
const itemQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be 1 or greater').max(100, 'Limit cannot exceed 100').default(20),
  search: z.string().max(50).optional(),
  type: z.enum(['Product', 'Service']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'unitPrice', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional()
}).strict();

module.exports = { createItemSchema, updateItemSchema, itemQuerySchema };
