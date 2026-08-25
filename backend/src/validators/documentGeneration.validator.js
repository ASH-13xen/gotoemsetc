const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const generate = {
  params: idParam,
  body: z.object({
    templateIds: z.array(z.string().min(1)).min(1),
    overrides: z.record(z.string(), z.any()).optional(),
  }),
};

const listForEmployee = { params: idParam };
const getOrDelete = { params: idParam };

// `since` defaults to the start of the current month (matching the
// Dashboard's "Documents generated this month" stat) when omitted — see
// document.controller.js#listRecent.
const listRecent = { query: z.object({ since: z.string().optional() }) };

const uploadSigned = {
  params: z.object({ id: z.string().min(1), docId: z.string().min(1) }),
};

// HR Work's "Show all generated documents" tool (frontendhr).
const overview = { query: z.object({ templateKey: z.string().min(1) }) };

module.exports = { generate, listForEmployee, getOrDelete, listRecent, uploadSigned, overview };
