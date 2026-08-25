require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const AttendanceRecord = require('../src/models/AttendanceRecord');

// One-off migration for the overtimeHours -> overtimeMinutes switch (see
// attendanceClassifier.service.js). Copies each record's existing
// overtimeHours (already in exact 0.5h multiples, so *60 loses nothing)
// into the new overtimeMinutes field. Never deletes or unsets anything —
// the old overtimeHours field is left exactly as it was on every document;
// this only adds a value to the new field alongside it. Safe to re-run:
// only touches records where overtimeMinutes hasn't already been set.
async function main() {
  await mongoose.connect(env.mongodbUri);

  const cursor = AttendanceRecord.find({
    overtimeHours: { $gt: 0 },
    overtimeMinutes: { $in: [null, 0, undefined] },
  }).cursor();

  let migrated = 0;
  for (let record = await cursor.next(); record != null; record = await cursor.next()) {
    record.overtimeMinutes = Math.round(record.overtimeHours * 60);
    // eslint-disable-next-line no-await-in-loop
    await record.save();
    migrated += 1;
  }

  console.log(`Migrated ${migrated} attendance record(s) from overtimeHours to overtimeMinutes.`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
