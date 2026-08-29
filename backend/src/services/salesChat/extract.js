const env = require('../../config/env');
const { getClient, usageTokens } = require('./geminiClient');
const { EXTRACTION_SYSTEM, EXTRACTION_RESPONSE_SCHEMA } = require('./prompt');
const logger = require('../../utils/logger');

function transcriptText(messages) {
  return messages
    .map((m) => `${m.role === 'user' ? 'Visitor' : 'Bot'}: ${m.content}`)
    .join('\n');
}

const EMPTY_STATE = {
  qualification: {},
  buyingSignal: 'none',
  explicitMeetingAsk: false,
  requestedHuman: false,
  disqualify: { isDisqualified: false, reason: null },
  sentiment: 'neutral',
  summary: '',
};

// One call on the fast model, constrained to Gemini's native JSON mode, to
// turn the transcript into structured state. Never throws — a parsing/API
// failure returns EMPTY_STATE so the turn still completes (score/routing
// just don't move that turn).
async function extractTurnState(messages) {
  try {
    const client = getClient();
    const response = await client.models.generateContent({
      model: env.gemini.extractionModel,
      contents: transcriptText(messages),
      config: {
        systemInstruction: EXTRACTION_SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: EXTRACTION_RESPONSE_SCHEMA,
        maxOutputTokens: 1024,
      },
    });

    const tokens = usageTokens(response.usageMetadata);
    if (!response.text) return { state: EMPTY_STATE, tokens };

    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch (parseErr) {
      logger.warn({ err: parseErr.message }, 'salesChat extraction returned non-JSON text');
      return { state: EMPTY_STATE, tokens };
    }
    return { state: { ...EMPTY_STATE, ...parsed }, tokens };
  } catch (err) {
    logger.error({ err }, 'salesChat extraction failed');
    return { state: EMPTY_STATE, tokens: 0 };
  }
}

module.exports = { extractTurnState };
