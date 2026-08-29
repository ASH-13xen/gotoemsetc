const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');
const salesChatService = require('../services/salesChat');

function assertConfigured() {
  if (!env.salesChatConfigured) {
    throw ApiError.internal('The sales chatbot is not configured on this server yet (missing GEMINI_API_KEY)');
  }
}

// Unauthenticated health probe for the widget to check before it renders the
// chat vs. just showing the fallback form outright.
const health = (req, res) => {
  res.json({ status: env.salesChatConfigured ? 'ok' : 'not_configured' });
};

const startSession = asyncHandler(async (req, res) => {
  assertConfigured();
  const result = await salesChatService.startSession(req.body);
  res.status(201).json(result);
});

// Server-Sent Events — the response is a long-lived stream, not one JSON
// body. Anything that can fail *before* the stream opens (bad token,
// missing conversation) still goes through assertConfigured()/asyncHandler
// and the normal error middleware; everything after headers are sent must
// be written onto the stream itself instead.
const postMessage = asyncHandler(async (req, res) => {
  assertConfigured();
  const { id } = req.params;
  const { sessionToken, text, clientMsgId } = req.body;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Render (and most proxies) buffer text/event-stream by default unless
    // told not to — without this the visitor sees nothing until res.end().
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  const onEvent = (event) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await salesChatService.postMessage({ conversationId: id, sessionToken, text, clientMsgId, onEvent });
  } catch (err) {
    logger.error({ err, conversationId: id }, 'salesChat postMessage failed');
    if (!closed) {
      // ApiError messages (bad/expired token, not found) are safe to show;
      // anything else is a generic message so internals never leak to a
      // public endpoint.
      onEvent({ type: 'error', message: err.statusCode ? err.message : 'Something went wrong. Please try again.' });
    }
  } finally {
    if (!closed) res.end();
  }
});

const handoff = asyncHandler(async (req, res) => {
  assertConfigured();
  const { id } = req.params;
  const result = await salesChatService.requestHandoff({ conversationId: id, ...req.body });
  res.json(result);
});

// Works even when the bot itself is unconfigured — it's the plain-form
// escape hatch, and must never be blocked by an LLM outage or a missing key.
const fallbackForm = asyncHandler(async (req, res) => {
  const result = await salesChatService.submitFallbackForm(req.body);
  res.status(201).json(result);
});

module.exports = { health, startSession, postMessage, handoff, fallbackForm };
