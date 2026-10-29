const { z } = require('zod');

/**
 * Rounds a number to at most 2 decimal places.
 * Used for stock quantity precision enforcement.
 */
const quantityPrecision = z.number()
  .positive('Quantity must be strictly positive')
  .refine(val => {
    // Check max 2 decimal places: multiply by 100 and verify it's effectively an integer
    const shifted = Math.round(val * 100);
    return Math.abs(shifted - val * 100) < 0.0001;
  }, 'Quantity must have at most 2 decimal places').max(9999999, 'Quantity too large');

const stockInSchema = z.object({
  quantity: quantityPrecision,
  note: z.string().max(500, 'Note too long').optional()
}).strict();

const adjustSchema = z.object({
  newStock: z.number()
    .min(0, 'New stock cannot be negative')
    .max(9999999, 'Stock value too large')
    .refine(val => {
      const shifted = Math.round(val * 100);
      return Math.abs(shifted - val * 100) < 0.0001;
    }, 'Stock value must have at most 2 decimal places'),
  note: z.string().max(500, 'Note too long').optional()
}).strict();

module.exports = {
  stockInSchema,
  adjustSchema
};
