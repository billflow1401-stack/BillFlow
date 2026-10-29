require('dotenv').config({ path: 'a:/pre/backend/.env' });
if (process.env.CUSTOM_DNS_SERVERS) {
  require('dns').setServers(process.env.CUSTOM_DNS_SERVERS.split(','));
}
const mongoose = require('mongoose');
const Invoice = require('../src/models/Invoice');
const { generateDocumentIntegrityHash, createVerificationCodes } = require('../src/utils/documentAuth');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Migration] Connected to MongoDB');

  const invoices = await Invoice.find({
    $or: [
      { digitalSignature: { $exists: false } },
      { 'digitalSignature.verificationCode': { $exists: false } },
      { 'digitalSignature.verificationCode': null }
    ]
  });

  console.log(`[Migration] Found ${invoices.length} invoices needing digital signatures`);

  let updatedCount = 0;
  for (const inv of invoices) {
    const hash = generateDocumentIntegrityHash(inv);
    const codes = createVerificationCodes(hash, inv.date || inv.createdAt);
    const signer = inv.businessSnapshot?.ownerName || inv.businessSnapshot?.name || 'Authorized Signatory';

    await Invoice.updateOne(
      { _id: inv._id },
      {
        $set: {
          digitalSignature: {
            isSigned: true,
            signedBy: signer,
            designation: 'Authorized Signatory',
            signedAt: inv.createdAt || inv.date || new Date(),
            verificationCode: codes.verificationCode,
            documentHash: hash,
            auditId: codes.auditId
          }
        }
      }
    );
    console.log(`Migrated invoice ${inv.invoiceNumber} -> ${codes.verificationCode}`);
    updatedCount++;
  }

  console.log(`[Migration] Successfully updated ${updatedCount} invoices!`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
