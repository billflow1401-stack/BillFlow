const invoiceService = require('../services/invoice.service');
const pdfService = require('../services/pdf.service');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Business = require('../models/Business');
const AppError = require('../utils/AppError');
const { generateDocumentIntegrityHash, createVerificationCodes } = require('../utils/documentAuth');

/**
 * Helper to enrich invoice businessSnapshot with full business profile if missing
 */
const enrichBusinessSnapshot = async (invoiceDoc, businessId) => {
  if (!invoiceDoc || !businessId) return invoiceDoc;
  const business = await Business.findById(businessId).lean();
  if (!business) return invoiceDoc;

  const currentSnapshot = invoiceDoc.businessSnapshot?.toObject
    ? invoiceDoc.businessSnapshot.toObject()
    : (invoiceDoc.businessSnapshot || {});

  const enriched = {
    ...currentSnapshot,
    name: currentSnapshot.name || business.name || '',
    ownerName: currentSnapshot.ownerName || business.ownerName || '',
    tagline: currentSnapshot.tagline || business.tagline || '',
    gstin: currentSnapshot.gstin || business.gstin || '',
    pan: currentSnapshot.pan || business.pan || '',
    address: currentSnapshot.address || business.address || '',
    city: currentSnapshot.city || business.city || '',
    state: currentSnapshot.state || business.state || '',
    pinCode: currentSnapshot.pinCode || business.pinCode || '',
    country: currentSnapshot.country || business.country || 'India',
    phone: currentSnapshot.phone || business.phone || '',
    alternatePhone: currentSnapshot.alternatePhone || business.alternatePhone || '',
    email: currentSnapshot.email || business.email || '',
    website: currentSnapshot.website || business.website || '',
    logoUrl: currentSnapshot.logoUrl || business.logoUrl || '',
    bankDetails: {
      bankName: currentSnapshot.bankDetails?.bankName || business.bankDetails?.bankName || '',
      accountNumber: currentSnapshot.bankDetails?.accountNumber || business.bankDetails?.accountNumber || '',
      ifsc: currentSnapshot.bankDetails?.ifsc || business.bankDetails?.ifsc || '',
      branchName: currentSnapshot.bankDetails?.branchName || business.bankDetails?.branchName || '',
      accountName: currentSnapshot.bankDetails?.accountName || business.bankDetails?.accountName || ''
    },
    signature: {
      url: currentSnapshot.signature?.url || business.signature?.url || '',
      signerName: currentSnapshot.signature?.signerName || business.signature?.signerName || business.ownerName || business.name || '',
      designation: currentSnapshot.signature?.designation || business.signature?.designation || 'Authorized Signatory'
    },
    seal: {
      url: currentSnapshot.seal?.url || business.seal?.url || ''
    }
  };

  if (typeof invoiceDoc.set === 'function') {
    invoiceDoc.set('businessSnapshot', enriched);
  } else {
    invoiceDoc.businessSnapshot = enriched;
  }

  // Ensure digital signature is populated even for legacy invoices
  if (!invoiceDoc.digitalSignature || !invoiceDoc.digitalSignature.verificationCode) {
    const hash = generateDocumentIntegrityHash(invoiceDoc);
    const codes = createVerificationCodes(hash, invoiceDoc.date);
    const signerName = enriched.signature.signerName || 'Authorized Signatory';
    const signerDesignation = enriched.signature.designation || 'Authorized Signatory';
    const sigObj = {
      isSigned: true,
      signedBy: signerName,
      designation: signerDesignation,
      signedAt: invoiceDoc.createdAt || invoiceDoc.date || new Date(),
      verificationCode: codes.verificationCode,
      documentHash: hash,
      auditId: codes.auditId
    };
    if (typeof invoiceDoc.set === 'function') {
      invoiceDoc.set('digitalSignature', sigObj);
    } else {
      invoiceDoc.digitalSignature = sigObj;
    }

    // Persist to database so verification searches find it immediately
    if (invoiceDoc._id) {
      Invoice.updateOne({ _id: invoiceDoc._id }, { $set: { digitalSignature: sigObj } }).catch(err => {
        console.warn('[Invoice] Failed to persist digital signature during enrichment:', err.message);
      });
    }
  }

  return invoiceDoc;
};

/**
 * Ephemeral calculation endpoint for frontend preview
 */
const calculatePreview = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const validatedData = req.body;

    const calculatedData = await invoiceService.calculateInvoice(businessId, validatedData, validatedData.items);

    res.status(200).json({
      status: 'success',
      data: {
        preview: calculatedData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new draft invoice
 */
const createDraft = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const validatedData = req.body;

    const invoice = await invoiceService.createDraftInvoice(businessId, validatedData);

    res.status(201).json({
      status: 'success',
      data: {
        invoice
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing draft invoice
 */
const updateDraft = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const invoiceId = req.params.id;
    const validatedData = req.body;

    // Prevent overriding protected fields
    delete validatedData.businessId;
    delete validatedData.invoiceNumber;
    delete validatedData.status;
    delete validatedData.paymentStatus;
    delete validatedData.summary;
    delete validatedData.paidAmount;
    delete validatedData.balanceDue;
    delete validatedData._id;
    delete validatedData.createdAt;
    delete validatedData.updatedAt;

    const invoice = await invoiceService.updateDraftInvoice(businessId, invoiceId, validatedData);

    res.status(200).json({
      status: 'success',
      data: {
        invoice
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all invoices for the authenticated business
 */
const getInvoices = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;

    const result = await invoiceService.getInvoices(businessId, req.validatedQuery || req.query);

    res.status(200).json({
      status: 'success',
      data: {
        invoices: result.data,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific invoice by ID
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const invoiceId = req.params.id;

    const invoiceDoc = await Invoice.findOne({ _id: invoiceId, businessId });
    if (!invoiceDoc) throw new AppError('Invoice not found', 404);

    const invoice = await enrichBusinessSnapshot(invoiceDoc, businessId);

    res.status(200).json({
      status: 'success',
      data: {
        invoice
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Finalize a draft invoice
 */
const finalize = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const invoiceId = req.params.id;

    const invoice = await invoiceService.finalizeInvoice(businessId, invoiceId);

    res.status(200).json({
      status: 'success',
      data: {
        invoice
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate and download PDF for a specific invoice
 */
const downloadPdf = async (req, res, next) => {
  try {
    const businessId = req.user.businessId;
    const invoiceId = req.params.id;
    const isReceipt = req.query.type === 'receipt';

    const invoiceDoc = await Invoice.findOne({ _id: invoiceId, businessId });
    if (!invoiceDoc) throw new AppError('Invoice not found', 404);

    const invoice = await enrichBusinessSnapshot(invoiceDoc, businessId);

    let payments = [];
    if (isReceipt) {
      payments = await Payment.find({ invoiceId, businessId }).sort({ paymentDate: -1, createdAt: -1 }).lean();
    }

    // Generate secure filename
    const rawNumber = invoice.invoiceNumber || invoice._id.toString();
    const safeFilename = encodeURIComponent(rawNumber.replace(/[^a-zA-Z0-9_-]/g, ''));
    const filePrefix = isReceipt ? 'Receipt' : 'Invoice';

    const pdfDoc = await pdfService.generateInvoicePdf(invoice, {
      type: isReceipt ? 'receipt' : 'clean',
      payments
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filePrefix}-${safeFilename}.pdf"`);

    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Length', result.length);
      res.send(result);
    });
    pdfDoc.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Public endpoint to verify document authenticity by Verification Code or Invoice Number.
 * Accessible without login so customers, banks, or auditors scanning the QR code can verify immediately.
 */
const publicVerify = async (req, res, next) => {
  try {
    const rawCode = (req.params.code || '').trim().replace(/^#+/, '');
    if (!rawCode) {
      return res.status(400).json({
        success: false,
        message: 'Verification code or invoice number is required'
      });
    }

    const escaped = rawCode.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const filterConditions = [
      { 'digitalSignature.verificationCode': { $regex: `^${escaped}$`, $options: 'i' } },
      { invoiceNumber: { $regex: `^${escaped}$`, $options: 'i' } },
      { 'digitalSignature.auditId': { $regex: `^${escaped}$`, $options: 'i' } }
    ];

    // Support legacy or flexible scans where verification code prefixes are stripped
    const stripped = rawCode.replace(/^BF-(?:VER|AUDIT)-/i, '').replace(/[^a-zA-Z0-9]/g, '');
    if (stripped && stripped.length >= 3) {
      const flexiblePattern = stripped.split('').map(c => c.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('[-_\\s]?');
      filterConditions.push({ invoiceNumber: { $regex: `^${flexiblePattern}$`, $options: 'i' } });
    }
    if (stripped && stripped.length >= 6) {
      filterConditions.push({ 'digitalSignature.documentHash': { $regex: `^${stripped}`, $options: 'i' } });
    }

    const invoice = await Invoice.findOne({ $or: filterConditions }).lean();
    if (!invoice) {
      return res.status(404).json({
        success: false,
        isAuthentic: false,
        message: 'No registered tax invoice matches this Verification Code or Invoice Number.'
      });
    }

    const documentHash = invoice.digitalSignature?.documentHash || generateDocumentIntegrityHash(invoice);
    const fallbackCodes = createVerificationCodes(documentHash, invoice.date || invoice.createdAt);
    const verificationCode = invoice.digitalSignature?.verificationCode || fallbackCodes.verificationCode;
    const auditId = invoice.digitalSignature?.auditId || fallbackCodes.auditId;

    res.status(200).json({
      success: true,
      data: {
        isAuthentic: true,
        verificationCode,
        auditId,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        status: invoice.status,
        billingMode: invoice.billingMode,
        business: {
          name: invoice.businessSnapshot?.name,
          gstin: invoice.businessSnapshot?.gstin,
          city: invoice.businessSnapshot?.city,
          state: invoice.businessSnapshot?.state
        },
        customer: {
          name: invoice.customerSnapshot?.name,
          gstin: invoice.customerSnapshot?.gstin
        },
        summary: {
          grandTotal: invoice.summary?.grandTotal ? String(invoice.summary.grandTotal) : '0.00',
          taxableTotal: invoice.summary?.taxableTotal ? String(invoice.summary.taxableTotal) : '0.00',
          taxTotal: invoice.summary?.taxTotal ? String(invoice.summary.taxTotal) : '0.00'
        },
        paymentStatus: {
          paidAmount: invoice.paymentStatus?.paidAmount ? String(invoice.paymentStatus.paidAmount) : '0.00',
          balanceDue: invoice.paymentStatus?.balanceDue ? String(invoice.paymentStatus.balanceDue) : '0.00',
          settlementDiscount: invoice.paymentStatus?.settlementDiscount ? String(invoice.paymentStatus.settlementDiscount) : '0.00',
          isSettled: Boolean(invoice.paymentStatus?.isSettled)
        },
        digitalSignature: {
          signedBy: invoice.digitalSignature?.signedBy || invoice.businessSnapshot?.ownerName || invoice.businessSnapshot?.name,
          designation: invoice.digitalSignature?.designation || 'Authorized Signatory',
          signedAt: invoice.digitalSignature?.signedAt || invoice.createdAt || invoice.date,
          documentHash: documentHash
        },
        auditTimeline: (invoice.auditTrail || []).map(t => ({
          action: t.action,
          description: t.description,
          performedBy: t.performedBy,
          timestamp: t.timestamp
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  calculatePreview,
  createDraft,
  updateDraft,
  getInvoices,
  getInvoiceById,
  finalize,
  downloadPdf,
  publicVerify
};
