require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');

// One-off: seeds the ecoId (biometric device PIN) counter to 999 so the
// *next* new employee auto-gets 1000 — safe to run even with existing
// employees, since manually-assigned ecoIds are untouched and this only
// affects future auto-generation (see employee.service.js#createEmployee).
async function main() {
  await mongoose.connect(env.mongodbUri);

  const result = await mongoose.connection.db
    .collection('counters')
    .updateOne({ _id: 'ecoId' }, { $set: { seq: 999 } }, { upsert: true });

  console.log(
    result.upsertedCount
      ? 'Created ecoId counter at 999 — next new employee will auto-get 1000.'
      : 'Reset ecoId counter to 999 — next new employee will auto-get 1000.'
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
