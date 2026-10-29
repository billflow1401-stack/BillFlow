const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Item = require('../models/Item');
const env = require('../config/env');
const { getBounds } = require('../utils/timezone');
const { serializeMonetary } = require('../utils/serializer');

/**
 * Get high-level business dashboard summary
 * Date boundaries are dynamically computed inside MongoDB using the APP_TIMEZONE.
 * @param {string} businessId
 */
const getDashboardSummary = async (businessId) => {
  // Determine the current year and month in the target timezone
  const now = new Date();
  const timeZone = env.timezone; // Defaults to 'Asia/Kolkata'
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric' }).formatToParts(now);
  const currentYear = parseInt(parts.find(p => p.type === 'year').value, 10);
  const currentMonth = parseInt(parts.find(p => p.type === 'month').value, 10);

  // Month in JS is 0-indexed, so we subtract 1 from currentMonth
  const startDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  // Next month calculation
  let nextYear = currentYear;
  let nextMonth = currentMonth + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  const endDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const { startBound, endBound } = getBounds(startDateStr, endDateStr, timeZone);

  const businessObjectId = new mongoose.Types.ObjectId(businessId);

  // 1. INVOICE METRICS
  // Sales, Count, GST, Outstanding from finalized/non-Draft invoices in current calendar month
  const invoiceStats = await Invoice.aggregate([
    {
      $match: {
        businessId: businessObjectId,
        status: { $ne: 'Draft' },
        date: { $gte: startBound, $lt: endBound }
      }
    },
    {
      $group: {
        _id: null,
        invoiceCount: { $sum: 1 },
        salesTotal: { $sum: "$summary.grandTotal" },
        outstandingAmount: { $sum: "$paymentStatus.balanceDue" },
        taxTotal: { $sum: "$summary.taxTotal" }
      }
    }
  ]);

  const invoiceData = invoiceStats[0] || { invoiceCount: 0, salesTotal: 0, outstandingAmount: 0, taxTotal: 0 };

  // 2. PAYMENT METRICS
  // Paid This Month from Payments recorded in current calendar month
  const paymentStats = await Payment.aggregate([
    {
      $match: {
        businessId: businessObjectId,
        paymentDate: { $gte: startBound, $lt: endBound }
      }
    },
    {
      $group: {
        _id: null,
        paidTotal: { $sum: "$amount" }
      }
    }
  ]);

  const paymentData = paymentStats[0] || { paidTotal: 0 };

  // 3. INVENTORY METRICS
  // Active Products only
  const [lowStockCount, outOfStockCount] = await Promise.all([
    Item.countDocuments({
      businessId: businessObjectId,
      type: 'Product',
      isActive: true,
      $expr: {
        $and: [
          { $ne: [{ $type: "$currentStock" }, "null"] },
          { $ne: [{ $type: "$lowStockThreshold" }, "null"] },
          { $gt: ["$currentStock", 0] },
          { $lte: ["$currentStock", "$lowStockThreshold"] }
        ]
      }
    }),
    Item.countDocuments({
      businessId: businessObjectId,
      type: 'Product',
      isActive: true,
      currentStock: 0
    })
  ]);

  // 4. RECENT INVOICES
  const recentInvoices = await Invoice.find({ businessId: businessObjectId })
    .sort({ date: -1, createdAt: -1 })
    .limit(5)
    .select('invoiceNumber date customerSnapshot.name status summary.grandTotal')
    .lean();

  return serializeMonetary({
    kpis: {
      salesTotal: invoiceData.salesTotal || '0.00',
      invoiceCount: invoiceData.invoiceCount,
      paidTotal: paymentData.paidTotal || '0.00',
      outstandingAmount: invoiceData.outstandingAmount || '0.00',
      taxTotal: invoiceData.taxTotal || '0.00',
      lowStockCount,
      outOfStockCount
    },
    recentInvoices,
    period: {
      year: currentYear,
      month: currentMonth,
      timeZone
    }
  });
};

module.exports = {
  getDashboardSummary
};
