// One-off migration: encrypts any existing plaintext password-like
// extraDetails values at rest. Safe to re-run — already-encrypted values are
// left untouched (see utils/extraDetailsCrypto.js#encryptList).
//
// Covered Employee and the old CRM Client until the Client Management System
// rebuild removed the latter; Employee is now the only model with encrypted
// extraDetails.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const Employee = require('../src/models/Employee');
const { isPasswordKey } = require('../src/utils/extraDetailsCrypto');

async function migrate(Model, label) {
  const docs = await Model.find({ 'extraDetails.key': { $regex: /password/i } });
  let touched = 0;
  let failed = 0;
  for (const doc of docs) {
    const hasPlaintext = doc.extraDetails.some(
      (d) => isPasswordKey(d.key) && d.value && !d.value.startsWith('enc:v1:')
    );
    if (!hasPlaintext) continue;
    try {
      doc.markModified('extraDetails');
      await doc.save();
      touched++;
    } catch (err) {
      failed++;
      console.error(`  Failed to migrate ${label} ${doc._id}: ${err.message}`);
    }
  }
  console.log(`${label}: ${docs.length} scanned, ${touched} encrypted, ${failed} failed`);
}

async function main() {
  await mongoose.connect(env.mongodbUri);
  await migrate(Employee, 'Employee');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
