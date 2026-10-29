const crypto = require('crypto');

/**
 * Deterministically generates a cryptographic SHA-256 integrity hash for an invoice document.
 * This guarantees mathematical tamper-evidence: any modification to invoice number,
 * date, business ID, grand total, or line items changes the hash completely.
 */
function generateDocumentIntegrityHash(invoice) {
  const invoiceNumber = invoice.invoiceNumber || 'DRAFT';
  const businessId = String(invoice.businessId || (invoice.businessSnapshot && invoice.businessSnapshot._id) || '');
  const dateStr = invoice.date ? new Date(invoice.date).toISOString().slice(0, 10) : '';
  const grandTotalStr = invoice.summary?.grandTotal ? String(invoice.summary.grandTotal) : '0.00';

  // Create deterministic fingerprint of line items
  const itemsFingerprint = (invoice.items || [])
    .map(item => `${item.name}:${item.quantity}:${item.unitPrice}:${item.gstRate}:${item.lineTotal}`)
    .join('|');

  const payload = `${businessId}|${invoiceNumber}|${dateStr}|${grandTotalStr}|${itemsFingerprint}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Creates human-readable short verification and audit codes based on the SHA-256 hash.
 */
function createVerificationCodes(hash, date = new Date()) {
  const shortHash = hash.substring(0, 8).toUpperCase();
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const dateTag = d.toISOString().slice(0, 10).replace(/-/g, '');
  return {
    verificationCode: `BF-VER-${shortHash}`,
    auditId: `BF-AUDIT-${dateTag}-${hash.substring(8, 14).toUpperCase()}`
  };
}

/**
 * Verifies if an invoice's current contents match its recorded cryptographic hash.
 */
function verifyDocumentIntegrity(invoice) {
  if (!invoice.digitalSignature?.documentHash) {
    return { isValid: false, reason: 'No cryptographic signature registered' };
  }
  const computedHash = generateDocumentIntegrityHash(invoice);
  const isValid = computedHash === invoice.digitalSignature.documentHash;
  return {
    isValid,
    recordedHash: invoice.digitalSignature.documentHash,
    computedHash,
    verificationCode: invoice.digitalSignature.verificationCode
  };
}

module.exports = {
  generateDocumentIntegrityHash,
  createVerificationCodes,
  verifyDocumentIntegrity
};
