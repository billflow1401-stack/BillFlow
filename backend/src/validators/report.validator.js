const { z } = require('zod');

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (dateString) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return false;
  return d.toISOString().startsWith(dateString);
};

const dateRangeSchema = z.object({
  startDate: z.string().regex(dateRegex, 'startDate must be YYYY-MM-DD').refine(isValidDate, 'Invalid startDate calendar date'),
  endDate: z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD').refine(isValidDate, 'Invalid endDate calendar date'),
}).superRefine((data, ctx) => {
  const { startDate, endDate } = data;
  if (!startDate || !endDate) return;

  if (startDate > endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startDate cannot be after endDate",
      path: ["startDate"],
    });
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Max range: startDate + 1 calendar year - 1 calendar day
  const maxEnd = new Date(start);
  maxEnd.setUTCFullYear(maxEnd.getUTCFullYear() + 1);
  maxEnd.setUTCDate(maxEnd.getUTCDate() - 1);

  if (end > maxEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Date range cannot exceed 1 calendar year",
      path: ["endDate"],
    });
  }
});

const hsnPaginationSchema = dateRangeSchema.and(z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(val => val >= 1, "Page must be >= 1").optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(val => val >= 1 && val <= 100, "Limit must be between 1 and 100").optional().default("50"),
}));

module.exports = {
  dateRangeSchema,
  hsnPaginationSchema
};
