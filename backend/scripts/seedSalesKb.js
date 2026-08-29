require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const SalesKbDoc = require('../src/models/SalesKbDoc');
const { SALES_KB_TYPE, CMS_PLAN_QUOTAS } = require('../src/config/constants');

// Offers are built from CMS_PLAN_QUOTAS — the same numbers the Client
// Management System uses to track fulfilment — so the chatbot can never
// quote a quota that drifts from what Ops actually delivers on. If a plan's
// quotas change, this seed picks it up automatically; nothing here is
// hand-typed.
function socialPlan(key, title, order) {
  const q = CMS_PLAN_QUOTAS[key];
  return {
    key: `offer-social-${key}`,
    type: SALES_KB_TYPE.OFFER,
    title,
    industry: [],
    services: ['social media management', 'social media', 'content'],
    tags: ['social', key],
    summary: `Social media management — ${q.posts.label} posts, ${q.reels.label} reels, ${q.dailyStoriesPerDay.label} stories/day, ${q.festiveStories.label} festive stories per month.`,
    body: `Monthly deliverables: ${q.posts.label} feed posts, ${q.reels.label} reels, ${q.dailyStoriesPerDay.label} stories per day, and ${q.festiveStories.label} festive/occasion stories. Ask the team for current pricing and add-ons.`,
    order,
  };
}

const offers = [
  socialPlan('gold', 'GO-TO x GOLD — Social Media Management', 1),
  socialPlan('platinum', 'GO-TO x PLATINUM — Social Media Management', 2),
  socialPlan('diamond', 'GO-TO x DIAMOND — Social Media Management', 3),
  {
    // TODO(sales-ops): fill in the real Standard/Pro/Premium tier
    // breakdown — kept generic here rather than guessing at inclusions.
    key: 'offer-podcast-marketing',
    type: SALES_KB_TYPE.OFFER,
    title: 'GO-TO x PM — Podcast Marketing',
    industry: [],
    services: ['podcast', 'podcast marketing', 'audio'],
    tags: ['podcast'],
    summary: 'Podcast marketing — production support, distribution, and audience growth. Tiers: Standard, Pro, Premium.',
    body: 'Ask the team for the current Standard/Pro/Premium tier breakdown and pricing before quoting specifics.',
    order: 4,
  },
  {
    key: 'offer-performance-marketing',
    type: SALES_KB_TYPE.SERVICE,
    title: 'Performance Marketing / Paid Ads',
    industry: [],
    services: ['performance marketing', 'paid ads', 'meta ads', 'google ads', 'digital marketing'],
    tags: ['ads', 'performance'],
    summary: 'Paid social and search campaigns (Meta, Google) run and optimised end-to-end, tied to a client-specific goal (leads, sales, installs).',
    body: 'Scope and budget are set per client based on goal and industry. Ask the team for current packages before quoting a figure.',
    order: 5,
  },
];

// Objection-handling guidance for the bot — coaching content, not claims
// about the company's own history, so there's nothing here that can be
// "wrong" the way a fabricated case study would be.
const objections = [
  {
    key: 'objection-too-expensive',
    type: SALES_KB_TYPE.OBJECTION,
    title: "Objection: \"That's too expensive\"",
    tags: ['objection', 'price'],
    summary: 'Reframe on outcome and scope rather than discounting on the spot.',
    body: 'Acknowledge the concern, ask what budget range they had in mind, and offer to scope a smaller starting package rather than discounting blind. Never invent a discount — offer to have the team follow up with options.',
    order: 1,
  },
  {
    key: 'objection-bad-past-agency',
    type: SALES_KB_TYPE.OBJECTION,
    title: 'Objection: "We tried an agency before and it didn\'t work"',
    tags: ['objection', 'trust'],
    summary: "Acknowledge, ask what went wrong, don't disparage the previous agency.",
    body: "Ask specifically what didn't work (communication, results, reporting) so the answer can address that concern directly instead of a generic pitch. Never criticise the named previous agency.",
    order: 2,
  },
];

const allDocs = [...offers, ...objections];

async function main() {
  await mongoose.connect(env.mongodbUri);

  const seededKeys = new Set(allDocs.map((d) => d.key));
  for (const doc of allDocs) {
    await SalesKbDoc.findOneAndUpdate({ key: doc.key }, doc, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    });
    console.log(`Seeded: ${doc.key}`);
  }

  // Deactivate anything previously seeded that's no longer in this list,
  // same pattern as seedTemplates.js.
  const stale = await SalesKbDoc.find({ key: { $nin: [...seededKeys], $exists: true } });
  for (const d of stale) {
    if (d.status !== 'archived') {
      d.status = 'archived';
      // eslint-disable-next-line no-await-in-loop
      await d.save();
      console.log(`Archived stale KB doc: ${d.key}`);
    }
  }

  console.log(
    '\nNOTE: no case studies were seeded. Fabricated client results would end up in front of real leads, ' +
      "so add real ones by hand (type: 'case_study', with an honest `outcome`) before launch — " +
      'the bot will simply not mention past results until at least one exists.'
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
