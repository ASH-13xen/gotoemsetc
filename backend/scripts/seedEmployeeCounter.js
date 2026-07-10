require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');

// One-off: employeeCode moved from "EMS-0001" to a plain incrementing
// number starting at 1001. Sets the counter to 1000 so the *next* hire
// gets 1001 — safe to run even with existing employees, since their old
// "EMS-XXXX" codes never collide with the new bare-number format.
async function main() {
  await mongoose.connect(env.mongodbUri);

  const result = await mongoose.connection.db
    .collection('counters')
    .updateOne({ _id: 'employeeCode' }, { $set: { seq: 1000 } }, { upsert: true });

  console.log(
    result.upsertedCount
      ? 'Created employeeCode counter at 1000 — next hire will be 1001.'
      : 'Reset employeeCode counter to 1000 — next hire will be 1001.'
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
