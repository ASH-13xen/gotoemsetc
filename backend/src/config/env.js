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

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  frontendUrl: frontendUrls[0],
  salesFrontendUrl: salesFrontendUrls[0],
  followupsFrontendUrl: followupsFrontendUrls[0],
  allFrontendUrl: allFrontendUrls[0],
  // Every allowed origin per app, for CORS (see app.js / websocket/clientChat.js).
  frontendUrls,
  salesFrontendUrls,
  followupsFrontendUrls,
  allFrontendUrls,

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

module.exports = env;
