const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const env = require('../config/env');
const { getBounds } = require('../utils/timezone');
const { serializeMonetary } = require('../utils/serializer');

const getBaseMatch = (businessId, startDate, endDate) => {
  const { startBound, endBound } = getBounds(startDate, endDate, env.timezone);
  return {
    businessId: new mongoose.Types.ObjectId(businessId),
    date: { $gte: startBound, $lt: endBound },
    status: { $ne: 'Draft' }
  };
};

const getSalesReport = async (businessId, startDate, endDate) => {
  const match = getBaseMatch(businessId, startDate, endDate);

  const [result] = await Invoice.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              salesTotal: { $sum: "$summary.grandTotal" },
              taxableTotal: { $sum: "$summary.taxableTotal" },
              taxTotal: { $sum: "$summary.taxTotal" },
              cgstTotal: { $sum: "$summary.cgstTotal" },
              sgstTotal: { $sum: "$summary.sgstTotal" },
              igstTotal: { $sum: "$summary.igstTotal" },
              discountTotal: { $sum: "$summary.discountTotal" },
              invoiceCount: { $sum: 1 },
              paidAgainstIncludedInvoices: { $sum: "$paymentStatus.paidAmount" },
              balanceDueOnIncludedInvoices: { $sum: "$paymentStatus.balanceDue" },
              settledCount: {
                $sum: { $cond: [{ $eq: ["$paymentStatus.isSettled", true] }, 1, 0] }
              },
              unsettledCount: {
                $sum: { $cond: [{ $ne: ["$paymentStatus.isSettled", true] }, 1, 0] }
              },
              intraStateCount: {
                $sum: { $cond: [{ $eq: ["$supplyType", "INTRA_STATE"] }, 1, 0] }
              },
              interStateCount: {
                $sum: { $cond: [{ $eq: ["$supplyType", "INTER_STATE"] }, 1, 0] }
              }
            }
          }
        ],
        typeBreakdown: [
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.type",
              salesTotal: { $sum: "$items.lineTotal" },
              taxableTotal: { $sum: "$items.taxableValue" },
              taxTotal: { $sum: "$items.taxAmount" },
              totalUnits: { $sum: "$items.quantity" },
              lineCount: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              type: "$_id",
              salesTotal: 1,
              taxableTotal: 1,
              taxTotal: 1,
              totalUnits: 1,
              lineCount: 1
            }
          }
        ],
        topItems: [
          { $unwind: "$items" },
          {
            $group: {
              _id: {
                name: "$items.name",
                type: "$items.type",
                hsnSac: "$items.hsnSac"
              },
              lineTotal: { $sum: "$items.lineTotal" },
              taxableValue: { $sum: "$items.taxableValue" },
              taxAmount: { $sum: "$items.taxAmount" },
              unitsSold: { $sum: "$items.quantity" }
            }
          },
          { $sort: { lineTotal: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              name: "$_id.name",
              type: "$_id.type",
              hsnSac: "$_id.hsnSac",
              lineTotal: 1,
              taxableValue: 1,
              taxAmount: 1,
              unitsSold: 1
            }
          }
        ],
        rateSlabs: [
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.gstRate",
              taxableValue: { $sum: "$items.taxableValue" },
              taxAmount: { $sum: "$items.taxAmount" },
              lineTotal: { $sum: "$items.lineTotal" },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              gstRate: "$_id",
              taxableValue: 1,
              taxAmount: 1,
              lineTotal: 1,
              count: 1
            }
          }
        ]
      }
    }
  ]);

  const summary = result?.summary?.[0] || {
    salesTotal: '0.00',
    taxableTotal: '0.00',
    taxTotal: '0.00',
    cgstTotal: '0.00',
    sgstTotal: '0.00',
    igstTotal: '0.00',
    discountTotal: '0.00',
    invoiceCount: 0,
    paidAgainstIncludedInvoices: '0.00',
    balanceDueOnIncludedInvoices: '0.00',
    settledCount: 0,
    unsettledCount: 0,
    intraStateCount: 0,
    interStateCount: 0
  };

  const response = {
    ...summary,
    typeBreakdown: result?.typeBreakdown || [],
    topItems: result?.topItems || [],
    rateSlabs: result?.rateSlabs || []
  };

  return serializeMonetary(response);
};

const getGSTSummary = async (businessId, startDate, endDate) => {
  const match = getBaseMatch(businessId, startDate, endDate);

  const stats = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        cgstTotal: { $sum: "$summary.cgstTotal" },
        sgstTotal: { $sum: "$summary.sgstTotal" },
        igstTotal: { $sum: "$summary.igstTotal" },
        totalTax: { $sum: "$summary.taxTotal" }
      }
    }
  ]);

  const defaultStats = {
    cgstTotal: '0.00',
    sgstTotal: '0.00',
    igstTotal: '0.00',
    totalTax: '0.00'
  };

  return serializeMonetary(stats[0] || defaultStats);
};

const getGSTRateWise = async (businessId, startDate, endDate) => {
  const match = getBaseMatch(businessId, startDate, endDate);

  const stats = await Invoice.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          gstRate: "$items.gstRate",
          taxTreatment: "$items.taxTreatment"
        },
        taxableValue: { $sum: "$items.taxableValue" },
        cgst: { $sum: "$items.cgst" },
        sgst: { $sum: "$items.sgst" },
        igst: { $sum: "$items.igst" },
        taxAmount: { $sum: "$items.taxAmount" }
      }
    },
    {
      $project: {
        _id: 0,
        gstRate: "$_id.gstRate",
        taxTreatment: "$_id.taxTreatment",
        taxableValue: 1,
        cgst: 1,
        sgst: 1,
        igst: 1,
        taxAmount: 1
      }
    },
    { $sort: { gstRate: 1, taxTreatment: 1 } }
  ]);

  return serializeMonetary(stats);
};

const getGSTHSNWise = async (businessId, startDate, endDate, page = 1, limit = 50) => {
  const match = getBaseMatch(businessId, startDate, endDate);
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: match },
    { $unwind: "$items" },
    {
      $addFields: {
        "items.hsnSac": {
          $cond: [
            { $or: [
              { $eq: ["$items.hsnSac", null] },
              { $eq: ["$items.hsnSac", ""] },
              { $not: ["$items.hsnSac"] }
            ]},
            "Uncategorized",
            "$items.hsnSac"
          ]
        }
      }
    },
    {
      $group: {
        _id: {
          classificationType: "$items.classificationType",
          hsnSac: "$items.hsnSac"
        },
        taxableValue: { $sum: "$items.taxableValue" },
        cgst: { $sum: "$items.cgst" },
        sgst: { $sum: "$items.sgst" },
        igst: { $sum: "$items.igst" },
        taxAmount: { $sum: "$items.taxAmount" },
        quantity: { $sum: "$items.quantity" }
      }
    },
    {
      $project: {
        _id: 0,
        classificationType: { $ifNull: ["$_id.classificationType", "Uncategorized"] },
        hsnSac: "$_id.hsnSac",
        taxableValue: 1,
        cgst: 1,
        sgst: 1,
        igst: 1,
        taxAmount: 1,
        quantity: 1
      }
    },
    { $sort: { classificationType: 1, hsnSac: 1 } }
  ];

  const facetResult = await Invoice.aggregate([
    ...pipeline,
    {
      $facet: {
        metadata: [{ $count: "totalRows" }],
        data: [{ $skip: skip }, { $limit: limit }]
      }
    }
  ]);

  const result = facetResult[0];
  const totalRows = result.metadata.length > 0 ? result.metadata[0].totalRows : 0;
  const totalPages = Math.ceil(totalRows / limit);

  return {
    data: serializeMonetary(result.data),
    pagination: {
      page,
      limit,
      totalRows,
      totalPages
    }
  };
};

module.exports = {
  getSalesReport,
  getGSTSummary,
  getGSTRateWise,
  getGSTHSNWise
};
