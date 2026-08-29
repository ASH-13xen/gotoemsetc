const { Schema, model } = require('mongoose');
const { SALES_KB_TYPE, SALES_KB_STATUS } = require('../config/constants');

// The grounding store for the sales chatbot. Every document is a structured
// record — the bot quotes case-study outcomes and offer details from here
// and nowhere else, so nothing about results or pricing is ever generated
// free-hand (see services/salesChat/prompt.js guardrails).
//
// Seeded and kept in sync by scripts/seedSalesKb.js — `key` is what makes
// that upsert idempotent. Semantic (vector) search is deliberately not here
// yet: at ~10-30 docs a Mongo text index plus industry/service/tag filters
// is enough, and Atlas Vector Search can be layered on later without a
// schema change.
const salesKbDocSchema = new Schema(
  {
    key: { type: String, unique: true, sparse: true, trim: true },
    type: { type: String, enum: Object.values(SALES_KB_TYPE), required: true, index: true },
    title: { type: String, required: true, trim: true },

    // case_study: the client's sector and what work was done, used to match
    // the doc to the visitor's own situation. offer/service: which industries
    // and service lines the package is for.
    industry: [{ type: String, trim: true, lowercase: true }],
    services: [{ type: String, trim: true, lowercase: true }],
    tags: [{ type: String, trim: true, lowercase: true }],

    // A one-line hook the bot can drop into conversation.
    summary: { type: String, trim: true },
    // The full record — problem, what we did, context. Trimmed before it's
    // handed to the model (see services/salesChat/kb.js).
    body: { type: String, trim: true },
    // case_study only: the measurable result. Kept as its own field so the
    // bot is never guessing at numbers.
    outcome: { type: String, trim: true },
    link: { type: String, trim: true },

    status: {
      type: String,
      enum: Object.values(SALES_KB_STATUS),
      default: SALES_KB_STATUS.ACTIVE,
      index: true,
    },
    // Display / tie-break order for get_offers.
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Backs kb.js's searchCaseStudies(). Weighted so a title/tag hit outranks a
// body hit. `default_language: 'none'` keeps it from stemming away the short
// industry/service tokens.
salesKbDocSchema.index(
  { title: 'text', summary: 'text', body: 'text', tags: 'text', industry: 'text', services: 'text' },
  {
    name: 'sales_kb_text',
    weights: { title: 10, tags: 6, industry: 6, services: 6, summary: 4, body: 1 },
    default_language: 'none',
  }
);

module.exports = model('SalesKbDoc', salesKbDocSchema);
