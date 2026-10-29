const { z } = require('zod');
const { isGstinStateMatching } = require('../utils/gstStateCodes');

// Base fields
const baseCustomerFields = {
  name: z.string().min(1, 'Name is required').max(200),
  customerType: z.enum(['Individual', 'Business']).optional(),
  gstStatus: z.enum(['Registered', 'Unregistered']).optional(),
  phone: z.string().max(15).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  billingAddress: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pinCode: z.string().max(10).optional(),
  country: z.string().max(100).optional(),
  gstin: z.string()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN format')
    .optional()
    .or(z.literal('')),
  pan: z.string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(2000).optional()
};

// Schema for POST (Create)
const createCustomerSchema = z.object(baseCustomerFields).strict().superRefine((data, ctx) => {
  if (data.gstStatus === 'Registered') {
    if (!data.gstin || !data.gstin.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gstin'],
        message: 'GSTIN is required when GST status is Registered'
      });
    } else if (data.state && data.state.trim()) {
      if (!isGstinStateMatching(data.gstin, data.state)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gstin'],
          message: 'GSTIN state code (first 2 digits) does not match the provided state'
        });
      }
    }
  }
});

const updateCustomerSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(200).optional(),
  customerType: z.enum(['Individual', 'Business']).optional(),
  gstStatus: z.enum(['Registered', 'Unregistered']).optional(),
  phone: z.string().max(15).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  billingAddress: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pinCode: z.string().max(10).optional(),
  country: z.string().max(100).optional(),
  gstin: z.string()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN format')
    .optional()
    .or(z.literal('')),
  pan: z.string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(2000).optional()
}).strict().superRefine((data, ctx) => {
  if (data.gstStatus === 'Registered') {
    if (data.gstin !== undefined && (!data.gstin || !data.gstin.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gstin'],
        message: 'GSTIN is required when GST status is Registered'
      });
    } else if (data.gstin && data.state && data.state.trim()) {
      if (!isGstinStateMatching(data.gstin, data.state)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gstin'],
          message: 'GSTIN state code (first 2 digits) does not match the provided state'
        });
      }
    }
  }
});

// Schema for GET (List) query parameters
const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be 1 or greater').max(100, 'Limit cannot exceed 100').default(20),
  search: z.string().max(50).optional(),
  customerType: z.enum(['Individual', 'Business']).optional(),
  gstStatus: z.enum(['Registered', 'Unregistered']).optional(),
  sort: z.enum(['name', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional()
}).strict();

module.exports = { createCustomerSchema, updateCustomerSchema, customerQuerySchema };
