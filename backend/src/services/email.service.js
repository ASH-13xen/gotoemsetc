const { Resend } = require('resend');
const env = require('../config/env');
const logger = require('../utils/logger');

const client = env.resendConfigured ? new Resend(env.resend.apiKey) : null;

async function sendEmail({ to, subject, html }) {
  if (!client) {
    logger.warn({ to, subject }, 'Resend not configured — skipping email send');
    return;
  }

  const { error } = await client.emails.send({
    from: env.resend.fromEmail,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message || 'Resend email send failed');
  }
}

module.exports = { sendEmail };
