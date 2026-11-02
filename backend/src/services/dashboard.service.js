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

  // 5. UNSETTLED PAYMENT REMINDERS (Partially Paid & Unpaid for >= 7 days / 1 week)
  const Money = require('../utils/money');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const reminderMatch = {
    businessId: businessObjectId,
    status: { $in: ['Partially Paid', 'Unpaid', 'Overdue'] },
    'paymentStatus.isSettled': { $ne: true },
    'paymentStatus.balanceDue': { $gt: Money.toDecimal128('0.00') },
    $or: [
      { date: { $lte: sevenDaysAgo } },
      { createdAt: { $lte: sevenDaysAgo } }
    ]
  };

  const [overdueInvoices, overdueStats] = await Promise.all([
    Invoice.find(reminderMatch)
      .sort({ date: 1, createdAt: 1 }) // Oldest unsettled first for maximum recovery urgency
      .limit(10)
      .select('invoiceNumber date createdAt dueDate customerSnapshot billingMode status summary.grandTotal paymentStatus')
      .lean(),
    Invoice.aggregate([
      { $match: reminderMatch },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBalance: { $sum: "$paymentStatus.balanceDue" }
        }
      }
    ])
  ]);

  const overdueReminders = overdueInvoices.map(inv => {
    const invDate = new Date(inv.date || inv.createdAt);
    const daysElapsed = Math.max(7, Math.floor((now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      createdAt: inv.createdAt,
      dueDate: inv.dueDate,
      daysElapsed,
      customerName: inv.customerSnapshot?.name || 'Walk-in / Counter Customer',
      customerPhone: inv.customerSnapshot?.phone || null,
      customerAddress: inv.customerSnapshot?.billingAddress || inv.customerSnapshot?.address || null,
      billingMode: inv.billingMode || inv.customerSnapshot?.billingMode || (inv.customerSnapshot?.gstin ? 'GST-Registered' : 'General'),
      status: inv.status,
      grandTotal: inv.summary?.grandTotal || '0.00',
      paidAmount: inv.paymentStatus?.paidAmount || '0.00',
      balanceDue: inv.paymentStatus?.balanceDue || '0.00'
    };
  });

  return serializeMonetary({
    kpis: {
      salesTotal: invoiceData.salesTotal || '0.00',
      invoiceCount: invoiceData.invoiceCount,
      paidTotal: paymentData.paidTotal || '0.00',
      outstandingAmount: invoiceData.outstandingAmount || '0.00',
      taxTotal: invoiceData.taxTotal || '0.00',
      lowStockCount,
      outOfStockCount,
      overdueRemindersCount: overdueStats[0]?.count || 0,
      overdueRemindersBalance: overdueStats[0]?.totalBalance || '0.00'
    },
    overdueReminders,
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
