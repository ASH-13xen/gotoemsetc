const { Schema, model } = require('mongoose');
const {
  SALES_LEAD_STATUS,
  SALES_SCORE_BAND,
  SALES_ROUTING_DESTINATION,
  SALES_CHAT_CHANNEL,
} = require('../config/constants');

// Structured discovery output. Every field is optional — the bot fills it in
// over the course of the conversation, and the per-turn extraction pass
// (services/salesChat/extract.js) only ever sets a field it actually heard.
// Reused verbatim on SalesConversation.
const qualificationSchema = new Schema(
  {
    primaryGoal: { type: String, trim: true },
    services: [{ type: String, trim: true }],
    budgetBand: { type: String, trim: true },
    timeline: { type: String, trim: true },
    decisionRole: { type: String, trim: true },
    companySizeBand: { type: String, trim: true },
    painPoints: [{ type: String, trim: true }],
    objections: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
  },
  { _id: false }
);

// One person who talked to the sales chatbot. Identity is best-effort: an
// anonymous visitor is keyed by `anonId` (a first-party cookie) until they
// give an email or phone, at which point those become the durable keys.
// Dedupe on those three is done in the service layer, not with a unique
// index — a half-typed email must not throw.
const salesLeadSchema = new Schema(
  {
    anonId: { type: String, trim: true, index: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true, index: true },
    company: { type: String, trim: true },
    industry: { type: String, trim: true },

    source: { type: String, default: SALES_CHAT_CHANNEL.WEB },
    // Filled from UTM / click-id query params on the landing page. Kept as a
    // loose bag — the Meta Conversions API wiring that will consume it comes
    // later.
    attribution: {
      utmSource: { type: String, trim: true },
      utmMedium: { type: String, trim: true },
      utmCampaign: { type: String, trim: true },
      referrer: { type: String, trim: true },
      landingPath: { type: String, trim: true },
      fbclid: { type: String, trim: true },
      gclid: { type: String, trim: true },
    },

    qualification: { type: qualificationSchema, default: () => ({}) },

    score: { type: Number, default: 0 },
    scoreBand: { type: String, enum: Object.values(SALES_SCORE_BAND), default: SALES_SCORE_BAND.D },
    // The two or three rule hits that drove the score — shown to a rep so the
    // number is never a black box.
    scoreFactors: [{ type: String, trim: true }],

    status: {
      type: String,
      enum: Object.values(SALES_LEAD_STATUS),
      default: SALES_LEAD_STATUS.NEW,
      index: true,
    },
    routingDestination: { type: String, enum: Object.values(SALES_ROUTING_DESTINATION) },
    routingReason: { type: String, trim: true },
    disqualifiedReason: { type: String, trim: true },

    // Whether the visitor was told (and didn't object to) email / WhatsApp
    // follow-up. The nurture engine that will read this is a later slice.
    consentContact: { type: Boolean, default: false },

    // Set true once a rep has been asked to take over (bot handoff or the
    // fallback form).
    handoffRequested: { type: Boolean, default: false },

    lastConversation: { type: Schema.Types.ObjectId, ref: 'SalesConversation' },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

salesLeadSchema.index({ status: 1, score: -1 });
salesLeadSchema.index({ createdAt: -1 });

module.exports = model('SalesLead', salesLeadSchema);
