const path = require('node:path');
require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  salesFrontendUrl: process.env.SALES_FRONTEND_URL || 'http://localhost:5174',
  followupsFrontendUrl: process.env.FOLLOWUPS_FRONTEND_URL || 'http://localhost:5175',
  allFrontendUrl: process.env.ALL_FRONTEND_URL || 'http://localhost:5176',

  mongodbUri: required('MONGODB_URI'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

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

  sofficePath: process.env.SOFFICE_PATH || '',

  templatesDir: path.join(__dirname, '..', '..', 'templates', 'files'),

  companyName: process.env.COMPANY_NAME || 'Our Company',

  googleForm: {
    webhookSecret: process.env.GOOGLE_FORM_WEBHOOK_SECRET || '',
  },
};

env.cloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

env.smtpConfigured = Boolean(env.smtp.host && env.smtp.port && env.smtp.user && env.smtp.pass);

module.exports = env;
