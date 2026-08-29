const { z } = require('zod');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const attribution = z
  .object({
    utmSource: z.string().trim().max(200).optional(),
    utmMedium: z.string().trim().max(200).optional(),
    utmCampaign: z.string().trim().max(200).optional(),
    referrer: z.string().trim().max(500).optional(),
    landingPath: z.string().trim().max(500).optional(),
    fbclid: z.string().trim().max(500).optional(),
    gclid: z.string().trim().max(500).optional(),
  })
  .optional();

const contact = z
  .object({
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().max(30).optional(),
  })
  .optional();

const startSession = {
  body: z.object({
    // First-party cookie the widget mints on first load — carries an
    // anonymous visitor until a real identity key (email/phone) shows up.
    anonId: z.string().trim().min(1).max(200).optional(),
    attribution,
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().max(30).optional(),
  }),
};

const postMessage = {
  ...idParam,
  body: z.object({
    sessionToken: z.string().min(1),
    text: z.string().trim().min(1).max(4000),
    // Client-generated idempotency key — a retried send is dropped, not
    // replayed as a second turn. See orchestrator.js.
    clientMsgId: z.string().trim().max(100).optional(),
  }),
};

const handoff = {
  ...idParam,
  body: z.object({
    sessionToken: z.string().min(1),
    contact,
  }),
};

const fallbackForm = {
  body: z.object({
    anonId: z.string().trim().min(1).max(200).optional(),
    attribution,
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().max(30).optional(),
    company: z.string().trim().max(200).optional(),
    message: z.string().trim().max(2000).optional(),
  }),
};

module.exports = { startSession, postMessage, handoff, fallbackForm };
