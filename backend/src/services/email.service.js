const env = require('../config/env');
const logger = require('../utils/logger');

// Best-effort, like activity.service.js — a messaging failure (bad key,
// Resend outage, unverified domain) must never block the hire/reject/
// schedule action it's attached to. Callers get a boolean, not a throw.
async function sendEmail({ to, subject, html }) {
  if (!env.emailConfigured) {
    logger.warn({ to, subject }, 'Resend is not configured — skipping email send');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.resend.fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ status: res.status, body, to, subject }, 'Resend email send failed');
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, to, subject }, 'Resend email send threw');
    return false;
  }
}

module.exports = { sendEmail };
