const { GoogleGenAI } = require('@google/genai');
const env = require('../../config/env');
const logger = require('../../utils/logger');

// One shared client. Constructed lazily so the server still boots when
// GEMINI_API_KEY is unset (every other feature keeps working; the sales
// chat route returns a clear 503 — see salesChat.controller.js).
let client = null;
function getClient() {
  if (!env.geminiConfigured) {
    throw new Error('GEMINI_API_KEY is not set — the sales chatbot is disabled');
  }
  if (!client) client = new GoogleGenAI({ apiKey: env.gemini.apiKey });
  return client;
}

// Process-local daily token counter. A soft ceiling on a single instance,
// not an org-wide cap — enough to stop a runaway or an abuse spike from
// quietly running up the bill. Resets at UTC midnight and on restart.
let dayKey = new Date().toISOString().slice(0, 10);
let daySpent = 0;

function rollDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    daySpent = 0;
  }
}

function noteSpend(tokens) {
  rollDay();
  daySpent += tokens || 0;
}

function dailyCapExceeded() {
  rollDay();
  return daySpent >= env.salesChat.dailyTokenCap;
}

function spendSnapshot() {
  rollDay();
  return { day: dayKey, tokens: daySpent, cap: env.salesChat.dailyTokenCap };
}

// Gemini reports one rolled-up total (prompt + candidates + thoughts + tool
// results) on usageMetadata.totalTokenCount — no multi-field sum needed like
// Anthropic's input/output/cache split.
function usageTokens(usageMetadata) {
  return (usageMetadata && usageMetadata.totalTokenCount) || 0;
}

module.exports = {
  getClient,
  noteSpend,
  dailyCapExceeded,
  spendSnapshot,
  usageTokens,
  logger,
};
