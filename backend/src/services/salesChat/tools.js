const kb = require('./kb');

// Tools available to the visitor-facing (streaming) model. Every one is
// read-only or purely advisory — nothing here writes to the lead/conversation
// directly (that happens once, deterministically, after extraction — see
// orchestrator.js) except flagging a handoff request on the shared `ctx`.
//
// Gemini groups function declarations under a single Tool entry (unlike
// Anthropic's flat array of tools) — see GenerateContentConfig.tools in
// @google/genai. parametersJsonSchema takes plain JSON Schema directly, so
// these are unchanged from a standard tool-input schema.
function getToolDefinitions() {
  return [
    {
      functionDeclarations: [
        {
          name: 'search_case_studies',
          description:
            'Look up 1-3 relevant past client results to share with the visitor. Use before claiming any outcome or result. Call at most once per visitor turn — if it returns no results, do not call it again; just continue without citing a specific example.',
          parametersJsonSchema: {
            type: 'object',
            properties: {
              industry: { type: 'string', description: "The visitor's industry, if known" },
              service: { type: 'string', description: 'The service line relevant to their need' },
              need: { type: 'string', description: 'A short phrase for what they want (e.g. "more leads")' },
            },
          },
        },
        {
          name: 'get_offers',
          description:
            'Get the current list of service packages/offers with what each includes. Use before quoting anything about pricing or packages.',
          parametersJsonSchema: { type: 'object', properties: {} },
        },
        {
          name: 'request_human_handoff',
          description:
            'Signal that a human teammate should take over — visitor explicitly asked, is frustrated, or the conversation needs judgement the bot cannot give.',
          parametersJsonSchema: {
            type: 'object',
            properties: {
              reason: { type: 'string', description: 'Short reason for the handoff' },
            },
            required: ['reason'],
          },
        },
      ],
    },
  ];
}

// ctx: { requestedHuman, handoffReason } — mutated in place so the caller can
// read the flag back after the tool loop finishes. Returns a plain object —
// Gemini's FunctionResponse.response field is JSON, not a string (unlike
// Anthropic's tool_result.content).
async function runTool(name, input, ctx) {
  switch (name) {
    case 'search_case_studies': {
      const results = await kb.searchCaseStudies(input || {});
      if (!results.length) {
        // An explicit "stop here" signal rather than a bare empty array —
        // otherwise a model facing zero results tends to retry the same
        // call instead of moving on, burning the tool-iteration budget on a
        // question with no answer coming.
        return {
          results: [],
          note: 'No matching case study on file for this. Do not call this tool again this turn — continue the conversation without citing a specific past result.',
        };
      }
      return { results };
    }
    case 'get_offers': {
      const offers = await kb.getOffers();
      return { offers };
    }
    case 'request_human_handoff': {
      ctx.requestedHuman = true;
      ctx.handoffReason = (input && input.reason) || 'Visitor requested a human';
      return { ok: true, note: 'A team member will be notified. Ask for the best contact detail if you do not already have one.' };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { getToolDefinitions, runTool };
