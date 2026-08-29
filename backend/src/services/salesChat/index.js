const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const SalesLead = require('../../models/SalesLead');
const SalesConversation = require('../../models/SalesConversation');
const orchestrator = require('./orchestrator');
const { notifyTeam } = require('./notify');
const { opener } = require('./prompt');
const {
  SALES_CONVERSATION_STATUS,
  SALES_NEXT_ACTION,
  SALES_LEAD_STATUS,
  SALES_ROUTING_DESTINATION,
} = require('../../config/constants');

// Deliberately separate audience from the staff JWT (see env.js) — a chat
// token verified with the wrong secret/audience is just rejected, never
// silently accepted as something else.
const SESSION_AUDIENCE = 'sales-chat';

function issueSessionToken(conversationId) {
  return jwt.sign({ cid: conversationId.toString() }, env.salesChat.sessionSecret, {
    audience: SESSION_AUDIENCE,
    expiresIn: env.salesChat.sessionTtl,
  });
}

function verifySessionToken(token, conversationId) {
  if (!token) throw ApiError.unauthorized('Missing session token');
  let payload;
  try {
    payload = jwt.verify(token, env.salesChat.sessionSecret, { audience: SESSION_AUDIENCE });
  } catch {
    throw ApiError.unauthorized('Invalid or expired session token');
  }
  if (payload.cid !== conversationId) throw ApiError.forbidden('Session token does not match this conversation');
  return payload;
}

// Identity resolution: email/phone are the durable keys once known, anonId
// carries an anonymous visitor until then. Best-effort, not a unique index —
// a half-typed email must never throw here.
async function findOrCreateLead({ anonId, email, phone, attribution }) {
  const normEmail = email ? email.toLowerCase().trim() : null;
  const normPhone = phone ? phone.trim() : null;

  let lead = null;
  if (normEmail) lead = await SalesLead.findOne({ email: normEmail });
  if (!lead && normPhone) lead = await SalesLead.findOne({ phone: normPhone });
  if (!lead && anonId) lead = await SalesLead.findOne({ anonId });

  if (!lead) {
    lead = new SalesLead({
      anonId,
      email: normEmail || undefined,
      phone: normPhone || undefined,
      attribution,
    });
  } else {
    if (anonId && !lead.anonId) lead.anonId = anonId;
    if (attribution) {
      lead.attribution = { ...(lead.attribution ? lead.attribution.toObject() : {}), ...attribution };
    }
  }
  return lead;
}

async function startSession({ anonId, attribution, name, email, phone } = {}) {
  if (!env.salesChatConfigured) {
    throw ApiError.internal('Sales chatbot is not configured (missing GEMINI_API_KEY or session secret)');
  }

  const lead = await findOrCreateLead({ anonId, email, phone, attribution });
  if (name && !lead.name) lead.name = name;
  await lead.save();

  const openerText = opener({ knownLead: lead });
  const conversation = await SalesConversation.create({
    lead: lead._id,
    anonId,
    attribution,
    status: SALES_CONVERSATION_STATUS.OPEN,
    messages: [{ role: 'assistant', content: openerText, at: new Date() }],
  });

  lead.lastConversation = conversation._id;
  lead.lastActivityAt = new Date();
  await lead.save();

  return {
    conversationId: conversation._id.toString(),
    sessionToken: issueSessionToken(conversation._id),
    opener: openerText,
    lead: { name: lead.name || null },
  };
}

async function loadForMessage(conversationId, sessionToken) {
  verifySessionToken(sessionToken, conversationId);
  const conversation = await SalesConversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const lead = await SalesLead.findById(conversation.lead);
  if (!lead) throw ApiError.notFound('Lead not found');
  return { conversation, lead };
}

async function postMessage({ conversationId, sessionToken, text, clientMsgId, onEvent }) {
  const { conversation, lead } = await loadForMessage(conversationId, sessionToken);
  await orchestrator.runTurn({ conversation, lead, userText: text, clientMsgId, onEvent });
}

// The visitor clicked "talk to a human" directly — no model call, just an
// immediate, deterministic route.
async function requestHandoff({ conversationId, sessionToken, contact }) {
  const { conversation, lead } = await loadForMessage(conversationId, sessionToken);
  if (contact?.email) lead.email = contact.email.toLowerCase().trim();
  if (contact?.phone) lead.phone = contact.phone.trim();
  if (contact?.name) lead.name = contact.name;

  conversation.status = SALES_CONVERSATION_STATUS.HANDOFF;
  conversation.nextAction = SALES_NEXT_ACTION.OFFER_HANDOFF;
  conversation.handoffReason = 'Visitor asked for a human via the escape hatch';
  conversation.lastActivityAt = new Date();

  lead.status = SALES_LEAD_STATUS.ROUTED;
  lead.routingDestination = SALES_ROUTING_DESTINATION.EXEC_QUEUE;
  lead.routingReason = conversation.handoffReason;
  lead.handoffRequested = true;
  lead.lastActivityAt = new Date();
  lead.lastConversation = conversation._id;

  await Promise.all([conversation.save(), lead.save()]);
  await notifyTeam(lead, { reason: conversation.handoffReason });
  return { conversationId: conversation._id.toString(), status: conversation.status };
}

// The plain fallback form — a visitor who skipped the chat entirely, or
// bailed out of it. Creates its own conversation record (already closed to
// the bot) so it lands in the same lead/rep pipeline as a chat-qualified one.
async function submitFallbackForm({ anonId, attribution, name, email, phone, company, message }) {
  if (!email && !phone) throw ApiError.badRequest('An email or phone number is required');

  const lead = await findOrCreateLead({ anonId, email, phone, attribution });
  if (name) lead.name = name;
  if (company) lead.company = company;

  const conversation = await SalesConversation.create({
    lead: lead._id,
    anonId,
    attribution,
    status: SALES_CONVERSATION_STATUS.HANDOFF,
    nextAction: SALES_NEXT_ACTION.OFFER_HANDOFF,
    handoffReason: 'Fallback form submitted',
    fallbackForm: { submitted: true, at: new Date(), message },
  });

  lead.status = SALES_LEAD_STATUS.ROUTED;
  lead.routingDestination = SALES_ROUTING_DESTINATION.EXEC_QUEUE;
  lead.routingReason = 'Fallback form submitted';
  lead.handoffRequested = true;
  lead.lastConversation = conversation._id;
  lead.lastActivityAt = new Date();
  await lead.save();
  await notifyTeam(lead, { reason: 'Fallback form submitted' });

  return { conversationId: conversation._id.toString() };
}

module.exports = {
  startSession,
  postMessage,
  requestHandoff,
  submitFallbackForm,
  issueSessionToken,
  verifySessionToken,
};
