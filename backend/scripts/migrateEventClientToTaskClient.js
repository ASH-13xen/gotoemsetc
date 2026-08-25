// One-off: Event.client used to reference the old CRM `Client` model, which
// the Client Management System rebuild removed. This remaps each event's
// client id onto the equivalent `TaskClient` (the single registry now shared
// by Task Management and the CMS), matching on name.
//
// Matching is by name because the two registries were never linked by id.
// A `Client` matches a `TaskClient` if its clientName OR brandName equals the
// TaskClient's name, case- and whitespace-insensitively. Anything that can't
// be matched is set to null and listed at the end — an event with no client
// link is valid (the field has always been optional).
//
// Reads the legacy `clients` collection through the raw driver, since the
// Mongoose model no longer exists. Idempotent: events whose client already
// points at a live TaskClient are left alone.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const Event = require('../src/models/Event');
const TaskClient = require('../src/models/TaskClient');

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(value) {
  return (value || '').trim().toLowerCase();
}

async function main() {
  await mongoose.connect(env.mongodbUri);
  const db = mongoose.connection.db;

  const events = await Event.find({ client: { $ne: null } }).lean();
  if (!events.length) {
    console.log('No events carry a client link — nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  const taskClients = await TaskClient.find({ isDeleted: false }).lean();
  const byName = new Map(taskClients.map((tc) => [normalize(tc.name), tc]));
  const liveTaskClientIds = new Set(taskClients.map((tc) => tc._id.toString()));

  const legacyExists = await db.listCollections({ name: 'clients' }).hasNext();
  const legacyClients = legacyExists ? await db.collection('clients').find({}).toArray() : [];
  const legacyById = new Map(legacyClients.map((c) => [c._id.toString(), c]));

  const migrated = [];
  const alreadyOk = [];
  const unmatched = [];

  for (const event of events) {
    const currentId = event.client.toString();

    if (liveTaskClientIds.has(currentId)) {
      alreadyOk.push(event.title);
      continue;
    }

    const legacy = legacyById.get(currentId);
    const match = legacy
      ? byName.get(normalize(legacy.clientName)) || byName.get(normalize(legacy.brandName))
      : null;

    if (match) {
      migrated.push({ event: event.title, from: legacy.clientName, to: match.name });
      if (!DRY_RUN) await Event.updateOne({ _id: event._id }, { $set: { client: match._id } });
    } else {
      unmatched.push({ event: event.title, legacyName: legacy ? legacy.clientName : '(client record not found)' });
      if (!DRY_RUN) await Event.updateOne({ _id: event._id }, { $set: { client: null } });
    }
  }

  console.log(DRY_RUN ? '--- DRY RUN, no writes ---' : '--- Applying changes ---');
  console.log(`Already pointing at a TaskClient: ${alreadyOk.length}`);
  console.log(`Remapped: ${migrated.length}`);
  migrated.forEach((m) => console.log(`  "${m.event}": ${m.from} -> ${m.to}`));
  console.log(`Unmatched (client link cleared): ${unmatched.length}`);
  unmatched.forEach((u) => console.log(`  "${u.event}": was ${u.legacyName}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
