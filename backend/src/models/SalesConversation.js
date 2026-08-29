const { Schema, model } = require('mongoose');
const {
  SALES_CONVERSATION_STATUS,
  SALES_SCORE_BAND,
  SALES_NEXT_ACTION,
  SALES_CHAT_CHANNEL,
} = require('../config/constants');

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    at: { type: Date, default: Date.now },
    // Client-generated idempotency key on user messages — a retried send
    // (flaky network, double tap) is dropped rather than replayed.
    clientMsgId: { type: String, trim: true },
    // Which tools ran while producing an assistant message, for the review
    // queue. Just names + a truncated result, not full payloads.
    toolCalls: [
      {
        _id: false,
        name: { type: String },
        input: { type: Schema.Types.Mixed },
        ok: { type: Boolean },
      },
    ],
  },
  { _id: false }
);

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

// One chat session on the landing page. Holds the full transcript plus the
// state the orchestrator rebuilds each turn: the merged qualification
// object, the latest score, and the deterministically-chosen next action.
const salesConversationSchema = new Schema(
  {
    lead: { type: Schema.Types.ObjectId, ref: 'SalesLead', required: true, index: true },
    anonId: { type: String, trim: true },
    channel: { type: String, default: SALES_CHAT_CHANNEL.WEB },
    status: {
      type: String,
      enum: Object.values(SALES_CONVERSATION_STATUS),
      default: SALES_CONVERSATION_STATUS.OPEN,
    },

    messages: { type: [messageSchema], default: [] },
    // Rolling summary — not used to trim context yet (transcripts are short),
    // but written every turn so it's ready when it's needed and so the rep
    // console has a one-paragraph read.
    summary: { type: String, trim: true },

    qualification: { type: qualificationSchema, default: () => ({}) },
    score: { type: Number, default: 0 },
    scoreBand: { type: String, enum: Object.values(SALES_SCORE_BAND), default: SALES_SCORE_BAND.D },
    scoreFactors: [{ type: String, trim: true }],

    nextAction: {
      type: String,
      enum: Object.values(SALES_NEXT_ACTION),
      default: SALES_NEXT_ACTION.CONTINUE,
    },
    // Count of visitor messages — the post-turn policy uses it for the hard
    // turn cap.
    turnCount: { type: Number, default: 0 },
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
    flags: [{ type: String, trim: true }],
    handoffReason: { type: String, trim: true },

    // Running total of Gemini tokens (prompt + candidates + tool results)
    // across every turn of this conversation — checked against
    // salesChat.perConversationTokenCap.
    tokensUsed: { type: Number, default: 0 },
    model: { type: String, trim: true },

    attribution: {
      utmSource: { type: String, trim: true },
      utmMedium: { type: String, trim: true },
      utmCampaign: { type: String, trim: true },
      referrer: { type: String, trim: true },
      landingPath: { type: String, trim: true },
      fbclid: { type: String, trim: true },
      gclid: { type: String, trim: true },
    },

    // The "prefer a form?" escape hatch — a visitor who bailed on the chat.
    fallbackForm: {
      submitted: { type: Boolean, default: false },
      at: { type: Date },
      message: { type: String, trim: true },
    },

    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = model('SalesConversation', salesConversationSchema);
