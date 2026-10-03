require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const TaskClient = require('../src/models/TaskClient');
const ClientPortalAccount = require('../src/models/ClientPortalAccount');

// One-off demo seed for the client dashboard (clientdashboard/) — 5 clients,
// 5 distinct two-color themes, 5 login accounts. Safe to re-run: each
// TaskClient is upserted by name, each ClientPortalAccount by username, so
// running this again just refreshes the password/theme rather than
// duplicating anything.
const DEMO_CLIENTS = [
  {
    name: 'Sunbeam Bakery',
    brandName: 'Sunbeam',
    username: 'sunbeambakery',
    password: 'Sunbeam#2026',
    theme: { primaryColor: '#FACC15', secondaryColor: '#111827' }, // yellow / near-black
  },
  {
    name: 'Pulse Fitness',
    brandName: 'Pulse',
    username: 'pulsefitness',
    password: 'Pulse#2026',
    theme: { primaryColor: '#EF4444', secondaryColor: '#1F2937' }, // red / charcoal
  },
  {
    name: 'Bloom Skincare',
    brandName: 'Bloom',
    username: 'bloomskincare',
    password: 'Bloom#2026',
    theme: { primaryColor: '#F472B6', secondaryColor: '#4C1D95' }, // rose / deep plum
  },
  {
    name: 'Nimbus Tech',
    brandName: 'Nimbus',
    username: 'nimbustech',
    password: 'Nimbus#2026',
    theme: { primaryColor: '#3B82F6', secondaryColor: '#0F172A' }, // blue / slate
  },
  {
    name: 'Verdant Foods',
    brandName: 'Verdant',
    username: 'verdantfoods',
    password: 'Verdant#2026',
    theme: { primaryColor: '#22C55E', secondaryColor: '#FEFCE8' }, // green / cream
  },
];

async function main() {
  await mongoose.connect(env.mongodbUri);

  const report = [];
  for (const demo of DEMO_CLIENTS) {
    const taskClient = await TaskClient.findOneAndUpdate(
      { name: demo.name },
      { $setOnInsert: { name: demo.name, brandName: demo.brandName } },
      { upsert: true, new: true }
    );

    const passwordHash = await bcrypt.hash(demo.password, 10);
    await ClientPortalAccount.findOneAndUpdate(
      { username: demo.username },
      {
        $set: {
          taskClient: taskClient._id,
          passwordHash,
          theme: demo.theme,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );

    report.push({ client: demo.name, username: demo.username, password: demo.password, theme: demo.theme });
  }

  console.log('Client portal demo accounts ready:\n');
  for (const r of report) {
    console.log(`${r.client.padEnd(16)} username: ${r.username.padEnd(16)} password: ${r.password.padEnd(14)} theme: ${r.theme.primaryColor} / ${r.theme.secondaryColor}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
