const { Resend } = require('resend');
const env = require('../config/env');
const logger = require('../utils/logger');

const client = env.resendConfigured ? new Resend(env.resend.apiKey) : null;

// attachments: [{ filename, content }] — content is a Buffer or base64
// string, passed straight through to Resend. Used by Finance (FnF settlement
// PDFs) — no other feature in this codebase emails a file yet.
async function sendEmail({ to, subject, html, from, attachments }) {
  if (!client) {
    logger.warn({ to, subject }, 'Resend not configured — skipping email send');
    return;
  }

  const { error } = await client.emails.send({
    from: from || env.resend.fromEmail,
    to,
    subject,
    html,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  });

  if (error) {
    throw new Error(error.message || 'Resend email send failed');
  }
}

module.exports = { sendEmail };
