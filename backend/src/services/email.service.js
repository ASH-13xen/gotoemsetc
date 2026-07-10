const env = require('../config/env');
const logger = require('../utils/logger');

// Best-effort, like activity.service.js — a messaging failure (bad key,
// Resend outage, unverified domain) must never block the hire/reject/
// schedule action it's attached to. Callers get { success, error }, never a
// throw — the error string is surfaced so callers that track per-channel
// delivery status (interview.service.js) can persist why it failed.
//
// Sends over plain HTTPS rather than SMTP deliberately — Render (and most
// PaaS hosts) block outbound SMTP ports platform-wide to combat spam abuse,
// so a raw SMTP connection times out from the deployed backend even with
// correct credentials. An HTTPS API call never hits that block.
async function sendEmail({ to, subject, html }) {
  if (!env.emailConfigured) {
    logger.warn({ to, subject }, 'Resend is not configured — skipping email send');
    return { success: false, error: 'Resend is not configured' };
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
      return { success: false, error: body || `Resend responded with ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    logger.error({ err, to, subject }, 'Resend email send threw');
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };
