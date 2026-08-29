const env = require('../../config/env');
const logger = require('../../utils/logger');
const { getClient, noteSpend, dailyCapExceeded, usageTokens } = require('./geminiClient');
const { buildSystemPrompt, PROMPT_VERSION } = require('./prompt');
const { getToolDefinitions, runTool } = require('./tools');
const { extractTurnState } = require('./extract');
const { computeScore } = require('./scoring');
const { notifyTeam } = require('./notify');
const kb = require('./kb');
const {
  SALES_CONVERSATION_STATUS,
  SALES_NEXT_ACTION,
  SALES_LEAD_STATUS,
  SALES_ROUTING_DESTINATION,
  SALES_SCORE_BAND,
} = require('../../config/constants');

const QUALIFICATION_SCALAR_KEYS = ['primaryGoal', 'budgetBand', 'timeline', 'decisionRole', 'companySizeBand', 'notes'];
const QUALIFICATION_ARRAY_KEYS = ['services', 'painPoints', 'objections'];
const MAX_TOOL_ITERATIONS = 4;

function mergeQualification(base = {}, incoming = {}) {
  const out = { ...(base.toObject ? base.toObject() : base) };
  for (const key of QUALIFICATION_SCALAR_KEYS) {
    if (incoming[key]) out[key] = incoming[key];
  }
  for (const key of QUALIFICATION_ARRAY_KEYS) {
    const merged = new Set([...(out[key] || []), ...((incoming[key] || []).filter(Boolean))]);
    out[key] = [...merged];
  }
  return out;
}

const CANNED_CAP_HIT = "We're experiencing heavy demand right now. I've let the team know you're interested — someone will follow up with you directly. Could you leave your email or phone number so they can reach you?";

// Runs one full turn: model call(s) with tools, structured extraction,
// scoring, the deterministic post-turn policy, and persistence. Emits
// { type, ... } events via onEvent for the SSE controller to forward;
// mutates and saves `conversation` and `lead` in place.
async function runTurn({ conversation, lead, userText, clientMsgId, onEvent }) {
  const emit = (event) => {
    try {
      onEvent(event);
    } catch (err) {
      logger.warn({ err }, 'salesChat onEvent failed');
    }
  };

  if (conversation.status !== SALES_CONVERSATION_STATUS.OPEN) {
    emit({
      type: 'done',
      conversationId: conversation._id.toString(),
      assistantMessage: "This conversation has been handed to our team — they'll be in touch. Feel free to leave any extra detail here.",
      nextAction: conversation.nextAction,
      status: conversation.status,
      score: conversation.score,
      band: conversation.scoreBand,
    });
    return;
  }

  // Idempotency: a retried send with the same client-generated id is a no-op,
  // not a second turn.
  if (clientMsgId && conversation.messages.some((m) => m.clientMsgId === clientMsgId)) {
    emit({
      type: 'done',
      conversationId: conversation._id.toString(),
      duplicate: true,
      nextAction: conversation.nextAction,
      status: conversation.status,
      score: conversation.score,
      band: conversation.scoreBand,
    });
    return;
  }

  conversation.messages.push({ role: 'user', content: userText, clientMsgId, at: new Date() });
  conversation.turnCount += 1;

  // Ingress guard: spend caps. No model call at all once tripped — cheaper
  // and faster than letting the loop run and failing later.
  const overConvoCap = conversation.tokensUsed >= env.salesChat.perConversationTokenCap;
  const overDailyCap = dailyCapExceeded();
  if (overConvoCap || overDailyCap) {
    logger.warn({ conversationId: conversation._id, overConvoCap, overDailyCap }, 'salesChat spend cap hit');
    conversation.messages.push({ role: 'assistant', content: CANNED_CAP_HIT, at: new Date() });
    conversation.status = SALES_CONVERSATION_STATUS.HANDOFF;
    conversation.nextAction = SALES_NEXT_ACTION.OFFER_HANDOFF;
    conversation.handoffReason = overDailyCap ? 'Daily spend cap reached' : 'Conversation spend cap reached';
    conversation.lastActivityAt = new Date();
    lead.status = SALES_LEAD_STATUS.ROUTED;
    lead.routingDestination = SALES_ROUTING_DESTINATION.EXEC_QUEUE;
    lead.routingReason = conversation.handoffReason;
    lead.handoffRequested = true;
    lead.lastActivityAt = new Date();
    lead.lastConversation = conversation._id;
    await Promise.all([conversation.save(), lead.save()]);
    await notifyTeam(lead, { reason: conversation.handoffReason });
    emit({
      type: 'done',
      conversationId: conversation._id.toString(),
      assistantMessage: CANNED_CAP_HIT,
      nextAction: conversation.nextAction,
      status: conversation.status,
      score: conversation.score,
      band: conversation.scoreBand,
    });
    return;
  }

  const client = getClient();
  const system = buildSystemPrompt({
    knownLead: { name: lead.name, company: lead.company, industry: lead.industry },
  });
  const tools = getToolDefinitions();
  // Gemini's Content role is 'user'/'model' (not 'assistant'), and a
  // conversation is expected to start with a user turn — the templated
  // opener is always messages[0] and is a UI-only greeting the model never
  // needs to see, so it's dropped when building history for the API call.
  const history = conversation.messages.slice(1).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
  const toolCallLog = [];
  const ctx = { requestedHuman: false, handoffReason: null };

  let assistantText = '';
  let turnTokens = 0;
  let iterations = 0;
  let modelFailed = false;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      iterations += 1;
      // eslint-disable-next-line no-await-in-loop
      const stream = await client.models.generateContentStream({
        model: env.gemini.chatModel,
        contents: history,
        config: {
          systemInstruction: system,
          tools,
          maxOutputTokens: 800,
        },
      });

      const turnParts = [];
      const functionCalls = [];
      let latestUsage = null;

      // eslint-disable-next-line no-await-in-loop
      for await (const chunk of stream) {
        // Read the raw parts straight off the candidate rather than through
        // the .text/.functionCalls convenience getters, and push them into
        // history verbatim. Thinking-capable Gemini models attach an opaque
        // `thoughtSignature` to a functionCall part that must be echoed back
        // unchanged on the next request (see
        // https://ai.google.dev/gemini-api/docs/thought-signatures) —
        // reconstructing a fresh { functionCall: call } object here would
        // silently drop it and the next call fails with a 400.
        const candidateParts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
          turnParts.push(part);
          if (part.text) {
            assistantText += part.text;
            emit({ type: 'token', text: part.text });
          }
          if (part.functionCall) {
            functionCalls.push(part.functionCall);
          }
        }
        if (chunk.usageMetadata) latestUsage = chunk.usageMetadata;
      }

      turnTokens += usageTokens(latestUsage);
      // A Content's parts array can't be empty — fall back to an empty text
      // part on a turn that produced neither text nor a function call.
      history.push({ role: 'model', parts: turnParts.length ? turnParts : [{ text: '' }] });

      if (functionCalls.length && iterations < MAX_TOOL_ITERATIONS) {
        emit({ type: 'tool', names: functionCalls.map((c) => c.name) });

        // eslint-disable-next-line no-await-in-loop
        const responseParts = await Promise.all(
          functionCalls.map(async (call) => {
            let responseValue;
            let ok = true;
            try {
              responseValue = await runTool(call.name, call.args, ctx);
            } catch (err) {
              ok = false;
              responseValue = { error: err.message };
            }
            toolCallLog.push({ name: call.name, input: call.args, ok });
            return { functionResponse: { id: call.id, name: call.name, response: responseValue } };
          })
        );
        history.push({ role: 'user', parts: responseParts });
        continue;
      }

      break;
    }
  } catch (err) {
    logger.error({ err, conversationId: conversation._id }, 'salesChat model call failed');
    modelFailed = true;
  }

  // Same fallback text is used for what's persisted and what's streamed as
  // the `done` event's assistantMessage — previously these could diverge
  // (e.g. the model called a tool repeatedly without ever producing text),
  // leaving the widget with an empty bubble even though the transcript had
  // a sensible line in it.
  assistantText =
    assistantText ||
    (modelFailed
      ? "Sorry, I hit a snag there. Could you say that again, or I can connect you with a teammate?"
      : "Let's continue — could you tell me a bit more?");

  conversation.messages.push({
    role: 'assistant',
    content: assistantText,
    at: new Date(),
    toolCalls: toolCallLog,
  });

  // Structured extraction — fast model, native JSON mode, never throws.
  const { state, tokens: extractionTokens } = await extractTurnState(conversation.messages);
  turnTokens += extractionTokens;

  conversation.tokensUsed += turnTokens;
  conversation.model = env.gemini.chatModel;
  noteSpend(turnTokens);

  const mergedQualification = mergeQualification(conversation.qualification, state.qualification || {});
  conversation.qualification = mergedQualification;
  conversation.summary = state.summary || conversation.summary;
  conversation.sentiment = state.sentiment || conversation.sentiment;
  if (ctx.requestedHuman) conversation.flags = [...new Set([...(conversation.flags || []), 'requested_human'])];

  // Identity fields go straight to the lead, not the shared qualification
  // shape — take the latest non-empty value the extraction pass heard.
  const q = state.qualification || {};
  if (q.name) lead.name = q.name;
  if (q.email) lead.email = q.email;
  if (q.phone) lead.phone = q.phone;
  if (q.company) lead.company = q.company;
  if (q.industry) lead.industry = q.industry;
  lead.qualification = mergedQualification;

  const catalog = await kb.getCatalog();
  const requestedHuman = ctx.requestedHuman || Boolean(state.requestedHuman);
  const scoreResult = computeScore(
    mergedQualification,
    {
      buyingSignal: state.buyingSignal,
      explicitMeetingAsk: Boolean(state.explicitMeetingAsk),
      turnCount: conversation.turnCount,
      disqualify: state.disqualify,
    },
    catalog
  );

  conversation.score = scoreResult.score;
  conversation.scoreBand = scoreResult.band;
  conversation.scoreFactors = scoreResult.factors;
  lead.score = scoreResult.score;
  lead.scoreBand = scoreResult.band;
  lead.scoreFactors = scoreResult.factors;

  // ---------------- Deterministic post-turn policy — never the model ----------------
  let nextAction = SALES_NEXT_ACTION.CONTINUE;
  let handoffReason = null;

  if (scoreResult.disqualified) {
    nextAction = SALES_NEXT_ACTION.DISQUALIFY;
  } else if (requestedHuman) {
    nextAction = SALES_NEXT_ACTION.OFFER_HANDOFF;
    handoffReason = ctx.handoffReason || 'Visitor requested a human';
  } else if (state.sentiment === 'negative' && conversation.turnCount >= 4 && scoreResult.score < 60) {
    nextAction = SALES_NEXT_ACTION.OFFER_HANDOFF;
    handoffReason = 'Visitor sentiment negative and unresolved';
  } else if (conversation.turnCount >= env.salesChat.maxUserTurns) {
    nextAction = scoreResult.score >= 60 ? SALES_NEXT_ACTION.OFFER_MEETING : SALES_NEXT_ACTION.OFFER_HANDOFF;
    handoffReason = nextAction === SALES_NEXT_ACTION.OFFER_HANDOFF ? 'Turn cap reached without a clear signal' : null;
  } else if (state.explicitMeetingAsk || state.buyingSignal === 'ready' || scoreResult.score >= 75) {
    nextAction = SALES_NEXT_ACTION.OFFER_MEETING;
  }

  conversation.nextAction = nextAction;
  conversation.handoffReason = handoffReason;
  conversation.lastActivityAt = new Date();

  const hasContact = Boolean((lead.email || '').trim() || (lead.phone || '').trim());
  // Captured before this turn's routing mutates lead.status — OFFER_MEETING
  // doesn't close the conversation, so a lead can pass through this branch
  // again on a later turn (still >=75, still asking). Without this guard
  // the team would get a fresh notification every single time.
  const wasAlreadyRouted = lead.status === SALES_LEAD_STATUS.ROUTED;

  if (nextAction === SALES_NEXT_ACTION.DISQUALIFY) {
    conversation.status = SALES_CONVERSATION_STATUS.CLOSED;
    lead.status = SALES_LEAD_STATUS.DISQUALIFIED;
    lead.disqualifiedReason = scoreResult.disqualifyReason;
    lead.routingDestination = SALES_ROUTING_DESTINATION.DISQUALIFY;
    lead.routingReason = scoreResult.disqualifyReason;
  } else if (nextAction === SALES_NEXT_ACTION.OFFER_HANDOFF) {
    conversation.status = SALES_CONVERSATION_STATUS.HANDOFF;
    lead.status = SALES_LEAD_STATUS.ROUTED;
    lead.routingDestination = SALES_ROUTING_DESTINATION.EXEC_QUEUE;
    lead.routingReason = handoffReason;
    lead.handoffRequested = true;
  } else if (nextAction === SALES_NEXT_ACTION.OFFER_MEETING) {
    lead.status = SALES_LEAD_STATUS.ROUTED;
    lead.routingDestination =
      scoreResult.band === SALES_SCORE_BAND.A && state.explicitMeetingAsk
        ? SALES_ROUTING_DESTINATION.CEO_TRACK
        : SALES_ROUTING_DESTINATION.SELF_BOOK;
    lead.routingReason = `Score ${scoreResult.band} (${scoreResult.score}) — ${state.summary || 'ready for a meeting'}`;
  } else if (scoreResult.score >= 40 && hasContact) {
    lead.status = SALES_LEAD_STATUS.QUALIFIED;
  } else if (lead.status === SALES_LEAD_STATUS.NEW) {
    lead.status = SALES_LEAD_STATUS.ENGAGED;
  }

  lead.lastActivityAt = new Date();
  lead.lastConversation = conversation._id;

  await Promise.all([conversation.save(), lead.save()]);

  if (!wasAlreadyRouted && (nextAction === SALES_NEXT_ACTION.OFFER_HANDOFF || nextAction === SALES_NEXT_ACTION.OFFER_MEETING)) {
    await notifyTeam(lead, { reason: lead.routingReason });
  }

  emit({
    type: 'done',
    conversationId: conversation._id.toString(),
    assistantMessage: assistantText,
    nextAction,
    status: conversation.status,
    score: scoreResult.score,
    band: scoreResult.band,
    scoreFactors: scoreResult.factors,
    qualification: mergedQualification,
    turnCount: conversation.turnCount,
    promptVersion: PROMPT_VERSION,
  });
}

module.exports = { runTurn };
