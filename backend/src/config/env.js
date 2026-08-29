const path = require('node:path');
require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Each *_FRONTEND_URL env var may list more than one origin, comma-
// separated (e.g. both a project's default vercel.app URL and a custom
// domain pointed at it) — CORS has to allow whichever one a browser is
// actually sitting on. Link-building code (emails, share tokens) still
// wants a single canonical URL, so that stays a plain string — the first
// configured origin.
function parseOrigins(value, fallback) {
  const raw = value || fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const frontendUrls = parseOrigins(process.env.FRONTEND_URL, 'http://localhost:5173');
const salesFrontendUrls = parseOrigins(process.env.SALES_FRONTEND_URL, 'http://localhost:5174');
const followupsFrontendUrls = parseOrigins(process.env.FOLLOWUPS_FRONTEND_URL, 'http://localhost:5175');
const allFrontendUrls = parseOrigins(process.env.ALL_FRONTEND_URL, 'http://localhost:5176');
// The public sales chatbot landing page (folder: /sales) — deployed on its
// own, later at sales.crm.gotofriend.in. Its own CORS group so it can be
// pointed at a different origin without touching the internal apps' lists.
const salesChatFrontendUrls = parseOrigins(process.env.SALES_CHAT_FRONTEND_URL, 'http://localhost:5177');

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  frontendUrl: frontendUrls[0],
  salesFrontendUrl: salesFrontendUrls[0],
  followupsFrontendUrl: followupsFrontendUrls[0],
  allFrontendUrl: allFrontendUrls[0],
  salesChatFrontendUrl: salesChatFrontendUrls[0],
  // Every allowed origin per app, for CORS (see app.js / websocket/clientChat.js).
  frontendUrls,
  salesFrontendUrls,
  followupsFrontendUrls,
  allFrontendUrls,
  salesChatFrontendUrls,

  mongodbUri: required('MONGODB_URI'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  // Used to encrypt sensitive Extra Details values at rest (see
  // utils/extraDetailsCrypto.js) — deliberately separate from JWT_SECRET so
  // rotating one doesn't affect the other.
  extraDetailsEncryptionKey: required('EXTRA_DETAILS_ENCRYPTION_KEY'),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 0,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || '',
  },
  hrNotificationEmail: process.env.HR_NOTIFICATION_EMAIL || '',
  // Broadcast copy for a routed sales lead, alongside the in-app
  // notification to admins/CEOs — see services/salesChat/notify.js. Point
  // this at a shared sales inbox; optional, same pattern as the line above.
  salesLeadNotificationEmail: process.env.SALES_LEAD_NOTIFICATION_EMAIL || '',

  // ---------------------------------------------------------------------
  // Sales chatbot (folder: /sales, routes: /api/sales-chat)
  // ---------------------------------------------------------------------
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    // Discovery turns run on a general Gemini model; the per-turn structured
    // extraction (qualification fields + signals) runs on a lighter/cheaper
    // one — same fast/cheap split as the build plan, just on Gemini instead
    // of Claude. Defaulted to the floating "-latest" aliases rather than a
    // dated snapshot: a hardcoded model (gemini-2.0-flash-lite) was retired
    // out from under this app during development and returned a 404 telling
    // callers to switch models. Pin to a specific one (e.g. gemini-3.7-flash
    // / gemini-3.5-flash-lite) instead if stability matters more than
    // automatically tracking Google's current pick — check what's live for
    // this key with `ai.models.list()` or https://ai.google.dev/gemini-api/docs/models.
    chatModel: process.env.SALES_CHAT_MODEL || 'gemini-flash-latest',
    extractionModel: process.env.SALES_CHAT_EXTRACTION_MODEL || 'gemini-flash-lite-latest',
  },
  salesChat: {
    // Signs the short-lived token the chat widget carries on every message
    // call — deliberately NOT JWT_SECRET, so a visitor's chat token can
    // never be mistaken for a staff login (same reasoning as
    // EXTRA_DETAILS_ENCRYPTION_KEY). Falls back to JWT_SECRET only so local
    // dev boots without a second secret set.
    sessionSecret: process.env.SALES_CHAT_SESSION_SECRET || process.env.JWT_SECRET || '',
    sessionTtl: process.env.SALES_CHAT_SESSION_TTL || '24h',
    // Ingress guards — a public, unauthenticated endpoint that calls a paid
    // LLM can't be allowed to run up the bill or starve the shared process.
    // Tokens are counted per conversation and across the whole calendar day
    // (UTC); the daily counter is process-local, so it's a soft ceiling on a
    // single instance, not a hard org-wide cap.
    perConversationTokenCap: Number(process.env.SALES_CHAT_CONVO_TOKEN_CAP) || 120000,
    dailyTokenCap: Number(process.env.SALES_CHAT_DAILY_TOKEN_CAP) || 4000000,
    // Soft target is ~8 turns (see the system prompt); at this many the
    // post-turn policy stops asking questions and forces an offer or handoff.
    maxUserTurns: Number(process.env.SALES_CHAT_MAX_TURNS) || 14,
  },

  sofficePath: process.env.SOFFICE_PATH || '',

  templatesDir: path.join(__dirname, '..', '..', 'templates', 'files'),
  templatesHtmlDir: path.join(__dirname, '..', '..', 'templates', 'html'),

  companyName: process.env.COMPANY_NAME || 'Our Company',

  googleForm: {
    webhookSecret: process.env.GOOGLE_FORM_WEBHOOK_SECRET || '',
  },
};

env.cloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

env.smtpConfigured = Boolean(env.smtp.host && env.smtp.port && env.smtp.user && env.smtp.pass);

env.resendConfigured = Boolean(env.resend.apiKey && env.resend.fromEmail);

env.geminiConfigured = Boolean(env.gemini.apiKey);
// The sales chat route refuses with a clear error (rather than 500s) when
// this is false — see salesChat.controller.js.
env.salesChatConfigured = Boolean(env.gemini.apiKey && env.salesChat.sessionSecret);

module.exports = env;
