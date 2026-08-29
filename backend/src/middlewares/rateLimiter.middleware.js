const rateLimit = require('express-rate-limit');

const publicUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Public sales chatbot (/api/sales-chat). Per-turn calls hit a paid LLM, so
// this is tighter than a normal API route — one visitor holding a genuine
// conversation sends well under this; a script hammering it does not.
const salesChatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'You are sending messages too quickly. Please wait a moment.' },
});

// Session creation and the fallback form — coarser actions, lower ceiling,
// keyed the same way (per IP) to blunt mass session spin-up.
const salesChatSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

module.exports = { publicUploadLimiter, salesChatLimiter, salesChatSessionLimiter };
