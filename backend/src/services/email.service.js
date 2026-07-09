const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

// Lazily built and cached — a fresh transporter per send would work too, but
// nodemailer's transporter pools/reuses the SMTP connection, which matters
// once this is sending more than one message a minute.
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

// Best-effort, like activity.service.js — a messaging failure (bad
// credentials, SMTP outage) must never block the hire/reject/schedule
// action it's attached to. Callers get { success, error }, never a throw —
// the error string is surfaced so callers that track per-channel delivery
// status (interview.service.js) can persist why it failed.
async function sendEmail({ to, subject, html }) {
  if (!env.smtpConfigured) {
    logger.warn({ to, subject }, 'SMTP is not configured — skipping email send');
    return { success: false, error: 'SMTP is not configured' };
  }

  try {
    await getTransporter().sendMail({
      from: env.smtp.from || env.smtp.user,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    logger.error({ err: err.message, to, subject }, 'SMTP email send failed');
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };
