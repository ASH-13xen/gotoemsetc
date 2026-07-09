require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');

// One-off: Applicant status went from applied/hired/rejected to
// pending/interview_scheduled/hired/rejected, and the single `resume` field
// became a `resumes` array (the form now allows up to 5 files). Run this once
// after deploying the new schema.
async function main() {
  await mongoose.connect(env.mongodbUri);
  const collection = mongoose.connection.db.collection('applicants');

  const statusResult = await collection.updateMany(
    { status: 'applied' },
    { $set: { status: 'pending' } }
  );
  console.log(`Updated status applied -> pending: ${statusResult.modifiedCount} documents`);

  const withResume = await collection
    .find({ resume: { $exists: true, $ne: null } })
    .toArray();
  let resumeMigrated = 0;
  for (const doc of withResume) {
    if (!doc.resume || !doc.resume.url) continue;
    await collection.updateOne(
      { _id: doc._id },
      { $set: { resumes: [doc.resume] }, $unset: { resume: '' } }
    );
    resumeMigrated += 1;
  }
  console.log(`Moved resume -> resumes[]: ${resumeMigrated} documents`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
