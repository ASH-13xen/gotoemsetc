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
// action it's attached to. Callers get a boolean, not a throw.
async function sendEmail({ to, subject, html }) {
  if (!env.smtpConfigured) {
    logger.warn({ to, subject }, 'SMTP is not configured — skipping email send');
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: env.smtp.from || env.smtp.user,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    logger.error({ err: err.message, to, subject }, 'SMTP email send failed');
    return false;
  }
}

module.exports = { sendEmail };
