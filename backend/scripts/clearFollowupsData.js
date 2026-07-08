require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');

// One-off: the Followups section's Task/Team/Meeting shapes changed in a
// backwards-incompatible way (pipeline went from 6 to 7 stages, Team gained
// a leader, Meeting gained a topic). Old records can't be migrated
// meaningfully, so this drops the three collections outright.
const COLLECTIONS = ['tasks', 'teams', 'meetings', 'pipelinelogentries'];

async function main() {
  await mongoose.connect(env.mongodbUri);

  for (const name of COLLECTIONS) {
    const result = await mongoose.connection.db.collection(name).deleteMany({});
    console.log(`Cleared ${name}: ${result.deletedCount} documents removed`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
