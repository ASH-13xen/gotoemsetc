const env = require('../config/env');
const logger = require('../utils/logger');

// Best-effort, same convention as email.service.js. `to` should be a
// WhatsApp-reachable phone number; digits only, with country code (no `+`,
// spaces or dashes) is what Meta's Cloud API expects.
function normalizeNumber(raw) {
  return String(raw || '').replace(/[^\d]/g, '');
}

async function sendTemplateMessage({ to, templateName, languageCode = 'en', components = [] }) {
  const toNumber = normalizeNumber(to);
  if (!env.whatsappConfigured) {
    logger.warn({ to, templateName }, 'WhatsApp Cloud API is not configured — skipping send');
    return false;
  }
  if (!toNumber) {
    logger.warn({ to, templateName }, 'No WhatsApp number to send to — skipping send');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ status: res.status, body, to: toNumber, templateName }, 'WhatsApp send failed');
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, to: toNumber, templateName }, 'WhatsApp send threw');
    return false;
  }
}

module.exports = { sendTemplateMessage };
