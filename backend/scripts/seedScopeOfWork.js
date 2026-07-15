require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const QuotationTemplate = require('../src/models/QuotationTemplate');

// Populates Scope of Work for every quotation template from the real PDFs
// in templates/quotations/ — without this, Task Management has nothing to
// generate tasks from no matter how many clients sign a quotation.
//
// Recurring monthly retainers (planType 'duration' — Diamond/Gold/Platinum):
// content deliverables are the same every month regardless of which
// duration (1/3/6/12mo) the client picked, so qtyPerCycle is literal.
//
// Podcast batches (planType 'quantity' — PM Premium/Pro/Standard): sold as
// a one-time batch of N podcasts, not a monthly retainer. qtyPerCycle here
// means "per podcast" — taskCycle.service.js multiplies it by the client's
// selected batch size (e.g. "4 podcasts") at generation time.
//
// Single podcast engagements (planType 'fixed' — RP Growth/Pro): one-time,
// qtyPerCycle is literal (already sized for exactly one podcast).

function steps(labels) {
  return labels.map((label, i) => ({ label, order: i + 1 }));
}

const RETAINER_STEPS = steps(['Plan of Action', 'Shoot', 'Edit', 'Caption Writing', 'Schedule', 'Publish', 'Report']);

const SCOPE_BY_KEY = {
  'go-to-diamond': [
    {
      name: 'Social Media Marketing',
      steps: RETAINER_STEPS,
      items: [
        { label: 'Reels', qtyPerCycle: 8 },
        { label: 'Static Posts', qtyPerCycle: 8 },
        { label: 'Stories', qtyPerCycle: 2, perDay: true },
        { label: 'Festive Stories', qtyPerCycle: 3 },
        { label: 'Monthly Performance Report', qtyPerCycle: 1 },
      ],
    },
  ],
  'go-to-gold': [
    {
      name: 'Social Media Marketing',
      steps: RETAINER_STEPS,
      items: [
        { label: 'Reels', qtyPerCycle: 6 },
        { label: 'Static Posts', qtyPerCycle: 6 },
        { label: 'Stories', qtyPerCycle: 1, perDay: true },
        { label: 'Festive Stories', qtyPerCycle: 2 },
        { label: 'Monthly Performance Report', qtyPerCycle: 1 },
      ],
    },
  ],
  'go-to-platinum': [
    {
      name: 'Social Media Marketing',
      steps: RETAINER_STEPS,
      items: [
        { label: 'Reels', qtyPerCycle: 7 },
        { label: 'Static Posts', qtyPerCycle: 7 },
        { label: 'Stories', qtyPerCycle: 1, perDay: true },
        { label: 'Festive Stories', qtyPerCycle: 3 },
        { label: 'Monthly Performance Report', qtyPerCycle: 1 },
      ],
    },
  ],
  'go-to-pm-premium': [
    {
      name: 'Podcast Production',
      steps: steps(['Plan of Action', 'Shoot', 'Edit', 'Deliver to Client']),
      items: [
        { label: 'Edited Podcast', qtyPerCycle: 1 },
        { label: 'Reels', qtyPerCycle: 3 },
      ],
    },
  ],
  'go-to-pm-pro': [
    {
      name: 'Podcast Production',
      steps: steps(['Plan of Action', 'Guest Coordination & Scripting', 'Shoot', 'Edit', 'Caption Writing', 'Schedule', 'Publish']),
      items: [
        { label: 'Edited Podcast', qtyPerCycle: 1 },
        { label: 'Reels', qtyPerCycle: 3 },
      ],
    },
  ],
  'go-to-pm-standard': [
    {
      name: 'Podcast Production',
      steps: steps(['Plan of Action', 'Shoot', 'Deliver Raw Clips to Client']),
      items: [{ label: 'Raw Podcast Clip', qtyPerCycle: 1 }],
    },
  ],
  'rp-growth': [
    {
      name: 'Podcast Production',
      steps: steps(['Plan of Action', 'Shoot', 'Edit', 'Caption Writing', 'Schedule', 'Publish']),
      items: [
        { label: 'Full Podcast Episode', qtyPerCycle: 1 },
        { label: 'Teaser Reel', qtyPerCycle: 1 },
        { label: 'Reels', qtyPerCycle: 2 },
        { label: 'Pre-Hype Story', qtyPerCycle: 1 },
        { label: 'During-Posting Story', qtyPerCycle: 1 },
        { label: 'Post-Upload Story', qtyPerCycle: 1 },
      ],
    },
  ],
  'rp-pro': [
    {
      name: 'Podcast Production',
      steps: steps(['Plan of Action', 'Shoot', 'Edit', 'Caption Writing', 'Schedule', 'Publish']),
      items: [
        { label: 'Full Podcast Episode', qtyPerCycle: 1 },
        { label: 'Teaser Reel', qtyPerCycle: 1 },
        { label: 'Reels', qtyPerCycle: 5 },
        { label: 'Pre-Hype Story', qtyPerCycle: 1 },
        { label: 'During-Posting Story', qtyPerCycle: 1 },
        { label: 'Post-Upload Story', qtyPerCycle: 1 },
      ],
    },
  ],
};

async function main() {
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB');

  for (const [key, scopeOfWork] of Object.entries(SCOPE_BY_KEY)) {
    const result = await QuotationTemplate.updateOne({ key }, { $set: { scopeOfWork } });
    if (result.matchedCount === 0) {
      console.warn(`No template found for key "${key}" — skipped`);
    } else {
      console.log(`Set scope of work for ${key} (${scopeOfWork.reduce((n, s) => n + s.items.length, 0)} item types)`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
