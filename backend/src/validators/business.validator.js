const { z } = require('zod');

const updateBusinessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ownerName: z.string().max(200).optional().or(z.literal('')),
  tagline: z.string().max(500).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
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
  phone: z.string().max(25).optional().or(z.literal('')),
  alternatePhone: z.string().max(25).optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  website: z.string().max(255).optional().or(z.literal('')),
  logoUrl: z.string().max(4000000).optional().or(z.literal('')),
  bankDetails: z.object({
    bankName: z.string().max(200).optional(),
    accountNumber: z.string().max(30).optional(),
    ifsc: z.string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format')
      .optional()
      .or(z.literal('')),
    branchName: z.string().max(200).optional(),
    accountName: z.string().max(200).optional()
  }).optional(),
  invoiceSettings: z.object({
    prefix: z.string().min(1).max(20).optional(),
    defaultDueDays: z.number().int().min(0).max(365).optional(),
    notes: z.string().max(2000).optional()
  }).optional(),
  signature: z.object({
    url: z.string().max(4000000).optional().or(z.literal('')),
    signerName: z.string().max(200).optional().or(z.literal('')),
    designation: z.string().max(200).optional().or(z.literal(''))
  }).optional(),
  seal: z.object({
    url: z.string().max(4000000).optional().or(z.literal(''))
  }).optional()
}).strict();

module.exports = { updateBusinessSchema };
