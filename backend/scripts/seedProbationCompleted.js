require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');

// probationCompleted (which gates the Paid Leave option) is a manual
// checkbox. This ticks it for every employee whose probation period has
// passed since joining — pass the period in months as the first argument
// (default 3, the current probation period); everyone else stays unticked
// for HR to set by hand.
// Only ever sets the flag to true, never clears it, and skips anyone it's
// already set on — safe to re-run.
async function main() {
  await mongoose.connect(env.mongodbUri);

  const probationMonths = Number(process.argv[2]) || 3;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - probationMonths);

  const result = await mongoose.connection.db
    .collection('employees')
    .updateMany(
      { dateOfJoining: { $lte: cutoff }, probationCompleted: { $ne: true } },
      { $set: { probationCompleted: true } }
    );

  console.log(
    `Marked probation completed (${probationMonths}-month probation) for ${result.modifiedCount} employee(s) who joined on or before ${cutoff
      .toISOString()
      .slice(0, 10)}.`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
