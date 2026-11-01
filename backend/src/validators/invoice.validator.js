const { z } = require('zod');
const Money = require('../utils/money');

const monetaryInput = (fieldName, defaultValue = undefined) => {
  const schema = z.union([z.number(), z.string()])
    .refine(val => {
      if (val === null || val === undefined || val === '') return defaultValue !== undefined;
      const str = String(val).trim();
      return /^\d+(\.\d{1,2})?$/.test(str);
    }, { message: `${fieldName} must be a valid non-negative monetary amount with at most 2 decimal places` })
    .transform(val => {
      if (val === null || val === undefined || val === '') return defaultValue;
      return Money.parseInput(val, { isOptional: defaultValue !== undefined, fieldName });
    });
  return defaultValue !== undefined ? schema.default(defaultValue) : schema;
};

const optionalMonetaryInput = (fieldName) => {
  return z.union([z.number(), z.string()])
    .refine(val => {
      if (val === null || val === undefined || val === '') return true;
      const str = String(val).trim();
      return /^\d+(\.\d{1,2})?$/.test(str);
    }, { message: `${fieldName} must be a valid non-negative monetary amount with at most 2 decimal places` })
    .transform(val => {
      if (val === null || val === undefined || val === '') return undefined;
      return Money.parseInput(val, { isOptional: true, fieldName });
    })
    .optional();
};

// Schema for an item in the invoice payload
const invoiceItemSchema = z.object({
  itemId: z.union([
    z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Item ID'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => (val ? val : undefined)),
  name: z.string().max(200).optional(),
  type: z.enum(['Product', 'Service']).optional().default('Product'),
  quantity: z.number().min(0.001, 'Quantity must be greater than 0').max(999999, 'Quantity too large'),
  discount: monetaryInput('Discount', '0.00'),
  unitPriceOverride: optionalMonetaryInput('unitPriceOverride')
}).strict().superRefine((data, ctx) => {
  const hasItemId = Boolean(data.itemId && String(data.itemId).trim().length > 0);
  const hasName = Boolean(data.name && String(data.name).trim().length > 0);
  if (!hasItemId && !hasName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['name'],
      message: 'Either itemId or a valid item name must be provided'
    });
  }
});

const quickCustomerSchema = z.object({
  name: z.string().max(200).optional(),
  phone: z.string().max(15).optional(),
  showPhoneOnInvoice: z.boolean().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  billingAddress: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pinCode: z.string().max(10).optional(),
  country: z.string().max(100).optional()
}).strict().optional();

// Schema for Draft Invoice Creation
const createDraftInvoiceSchema = z.object({
  billingMode: z.enum(['General', 'GST-Registered']).optional(),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Customer ID').optional(),
  quickCustomer: quickCustomerSchema,
  placeOfSupply: z.string().max(100).optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryState: z.string().max(100).optional(),
  showPhoneOnInvoice: z.boolean().optional(),
  date: z.string().datetime({ message: 'Invalid ISO date string for date' }),
  dueDate: z.string().datetime({ message: 'Invalid ISO date string for dueDate' }).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional(),
  terms: z.string().max(1000).optional()
}).strict().superRefine((data, ctx) => {
  if (data.billingMode === 'GST-Registered' && !data.customerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customerId'],
      message: 'A registered customer profile must be selected in GST-Registered mode.'
    });
  }
});

// Schema for Draft Invoice Update
const updateDraftInvoiceSchema = z.object({
  billingMode: z.enum(['General', 'GST-Registered']).optional(),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Customer ID').optional().nullable(),
  quickCustomer: quickCustomerSchema,
  placeOfSupply: z.string().max(100).optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryState: z.string().max(100).optional(),
  showPhoneOnInvoice: z.boolean().optional().nullable(),
  date: z.string().datetime({ message: 'Invalid ISO date string for date' }).optional(),
  dueDate: z.string().datetime({ message: 'Invalid ISO date string for dueDate' }).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  notes: z.string().max(1000).optional().nullable(),
  terms: z.string().max(1000).optional().nullable()
}).strict();

const calculateInvoiceSchema = z.object({
  billingMode: z.enum(['General', 'GST-Registered']).optional(),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Customer ID').optional().nullable(),
  quickCustomer: quickCustomerSchema,
  placeOfSupply: z.string().max(100).optional(),
  deliveryState: z.string().max(100).optional(),
  showPhoneOnInvoice: z.boolean().optional(),
  items: z.array(invoiceItemSchema)
}).strict();

// Schema for GET (List) query parameters
const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be 1 or greater').max(100, 'Limit cannot exceed 100').default(20),
  search: z.string().max(50).optional(),
  status: z.enum(['Draft', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue']).optional(),
  billingMode: z.enum(['General', 'GST-Registered']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid startDate format, must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid endDate format, must be YYYY-MM-DD').optional(),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Customer ID').optional(),
  sort: z.enum(['date', 'invoiceNumber', 'grandTotal', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional()
}).strict();

module.exports = {
  createDraftInvoiceSchema,
  updateDraftInvoiceSchema,
  calculateInvoiceSchema,
  invoiceQuerySchema
};
