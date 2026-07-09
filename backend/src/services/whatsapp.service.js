const env = require('../config/env');
const logger = require('../utils/logger');

// Best-effort, same convention as email.service.js. Meta's Cloud API expects
// digits only, with country code, no `+`/spaces/dashes. The recruitment form
// only collects a bare 10-digit Indian mobile number (no country code
// prompt), so a 10-digit result is assumed to be Indian and gets `91`
// prepended — without this Meta silently rejects the number as "not in
// allowed list" rather than actually delivering to it.
function normalizeNumber(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// Meta's error responses are JSON like { error: { message, code, ... } } —
// pull the human-readable message out for callers that persist it (e.g.
// interview.service.js's per-channel delivery status), falling back to the
// raw body if it's not in that shape.
function extractErrorMessage(rawBody) {
  try {
    const parsed = JSON.parse(rawBody);
    return parsed?.error?.message || rawBody;
  } catch {
    return rawBody;
  }
}

async function sendTemplateMessage({ to, templateName, languageCode = 'en', components = [] }) {
  const toNumber = normalizeNumber(to);
  if (!env.whatsappConfigured) {
    logger.warn({ to, templateName }, 'WhatsApp Cloud API is not configured — skipping send');
    return { success: false, error: 'WhatsApp Cloud API is not configured' };
  }
  if (!toNumber) {
    logger.warn({ to, templateName }, 'No WhatsApp number to send to — skipping send');
    return { success: false, error: 'No WhatsApp number on file' };
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
      return { success: false, error: extractErrorMessage(body) };
    }

    return { success: true };
  } catch (err) {
    logger.error({ err, to: toNumber, templateName }, 'WhatsApp send threw');
    return { success: false, error: err.message };
  }
}

module.exports = { sendTemplateMessage };
