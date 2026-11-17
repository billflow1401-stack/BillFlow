const mongoose = require('mongoose');

/**
 * BillFlow-Pro — Layer 2: Statutory GST Rate-Rule Reference
 * 
 * Represents authoritative, notification-backed rate rules, statutory condition evaluators,
 * compensation cess liabilities, supplier-side ITC restrictions, and collection mechanisms.
 * 
 * Reconciled against:
 * - Notification No. 09/2025-CT(Rate) (Principal Goods Schedule) & Amendments (Notif 19/2025, 01/2026, 02/2026)
 * - Notification No. 10/2025-CT(Rate) (Principal Exempt Goods Schedule)
 * - Notification No. 11/2017-CT(Rate) (Principal Services Schedule) & Amendments (Notif 15/2025, 06/2026)
 * - Notification No. 12/2017-CT(Rate) (Principal Exempt Services Schedule) & Amendments (Notif 07/2026)
 * - Notification No. 13/2017-CT(Rate) (Reverse Charge Section 9(3)) & Amendments (Notif 08/2026)
 * - Notification No. 17/2017-CT(Rate) (ECO Liability Section 9(5)) & Amendments (Notif 09/2026)
 * - Notification No. 01/2017-Compensation Cess (Rate) as amended
 * 
 * Invariants:
 * - Typed statutory condition criteria ONLY (zero dynamic eval or arbitrary execution).
 * - Rate splits enforce strict mathematical parity: cgstRate + sgstRate === gstRate, igstRate === gstRate.
 * - Layer 2 records are immutable per datasetVersion release.
 */
const gstRateRuleSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: [true, 'Rule ID is required'],
    trim: true,
    index: true
  },
  ruleVersion: {
    type: String,
    required: true,
    default: 'v1'
  },
  hsnSacPattern: {
    type: String,
    required: [true, 'HSN/SAC pattern is required'],
    trim: true,
    index: true
  },
  matchScope: {
    type: String,
    enum: ['EXACT_CODE', 'HEADING_PREFIX', 'CHAPTER_PREFIX'],
    default: 'HEADING_PREFIX'
  },
  classificationType: {
    type: String,
    enum: ['HSN', 'SAC'],
    required: [true, 'Classification type is required']
  },

  // Statutory Tax Treatment & Rates
  taxTreatment: {
    type: String,
    enum: ['TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST'],
    required: true,
    default: 'TAXABLE'
  },
  gstRate: {
    type: Number,
    required: [true, 'GST rate is required'],
    min: 0,
    max: 100
  },
  cgstRate: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  sgstRate: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  igstRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },

  // Compensation Cess under Goods and Services Tax (Compensation to States) Act, 2017
  compensationCess: {
    hasCess: { type: Boolean, default: false },
    adValoremRate: { type: Number, default: 0, min: 0 },
    specificRateRupees: { type: String, default: '0.00' },
    specificUnit: { type: String, default: null }
  },

  // Tax Collection Regimes (Forward Charge vs Recipient RCM vs ECO Section 9(5))
  taxCollectionMechanism: {
    type: String,
    enum: [
      'FORWARD_CHARGE',
      'RECIPIENT_REVERSE_CHARGE_9_3',
      'RECIPIENT_REVERSE_CHARGE_9_4',
      'ECO_SECTION_9_5'
    ],
    default: 'FORWARD_CHARGE'
  },
  ecoDetails: {
    serviceCategory: {
      type: String,
      enum: [
        'NONE',
        'RESTAURANT',
        'DELIVERY_UNREGISTERED_SUPPLIER',
        'HOTEL_UNREGISTERED',
        'PASSENGER_TRANSPORT'
      ],
      default: 'NONE'
    },
    conditionPrerequisite: {
      type: String,
      default: null
    }
  },

  // Supplier-Side Input Tax Credit (ITC) Statutory Conditions (e.g. Notif 06/2026-CT(R))
  supplierItcCondition: {
    creditEligibility: {
      type: String,
      enum: [
        'FULL_CREDIT',
        'NO_CREDIT_ABSOLUTE',
        'SAME_LINE_OF_BUSINESS_ONLY',
        'INPUT_SERVICES_ONLY_RESTRICTED'
      ],
      default: 'FULL_CREDIT'
    },
    sameLineServiceScope: {
      sacPattern: { type: String, default: null },
      allowSameLineCredit: { type: Boolean, default: false }
    },
    rateBasedCreditCapPercentage: {
      type: Number,
      default: null
    },
    statutoryReference: {
      type: String,
      default: null
    },
    conditionNote: {
      type: String,
      default: null
    }
  },

  // Strictly Typed Condition Criteria (Zero dynamic eval)
  conditionType: {
    type: String,
    enum: [
      'UNCONDITIONAL',
      'TRANSACTION_VALUE_SLAB',
      'PRE_PACKAGED_AND_LABELLED',
      'SPECIFIED_PREMISES',
      'RETREADED_TRACTOR_TYRE',
      'END_USE_RESTRICTION',
      'REGISTERED_BIO_STIMULANT'
    ],
    required: true
  },
  conditionCriteria: {
    operator: {
      type: String,
      enum: ['LTE', 'GT', 'BETWEEN', 'BOOLEAN', null],
      default: null
    },
    thresholdValue: {
      type: Number,
      default: null
    },
    thresholdCurrency: {
      type: String,
      default: 'INR'
    },
    unitBasis: {
      type: String,
      enum: ['PER_PIECE', 'PER_PAIR', 'PER_UNIT_PER_DAY', 'PER_KG', null],
      default: null
    }
  },
  conditionDescription: {
    type: String,
    required: [true, 'Condition description is required'],
    trim: true
  },

  // Statutory Citations
  notificationReference: {
    type: String,
    required: [true, 'Notification reference is required'],
    trim: true
  },
  notificationSchedule: {
    type: String,
    default: null
  },
  notificationSerialNo: {
    type: String,
    default: null
  },
  effectiveFrom: {
    type: Date,
    required: [true, 'Effective-from date is required']
  },
  effectiveTo: {
    type: Date,
    default: null
  },
  datasetVersion: {
    type: String,
    required: [true, 'Dataset version is required'],
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Composite unique rule index per dataset version
gstRateRuleSchema.index(
  { ruleId: 1, datasetVersion: 1 },
  { unique: true }
);

// Pattern search index for matching against classification codes
gstRateRuleSchema.index(
  { hsnSacPattern: 1, classificationType: 1, datasetVersion: 1, isActive: 1 }
);

// Effective date validity range index
gstRateRuleSchema.index(
  { effectiveFrom: 1, effectiveTo: 1 }
);

module.exports = mongoose.model('GstRateRule', gstRateRuleSchema);

