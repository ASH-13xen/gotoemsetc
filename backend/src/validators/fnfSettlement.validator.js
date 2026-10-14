const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

// multipart: the transaction details as fields plus the receipt as `receipt`.
const markPaid = {
  params: idParam,
  body: z.object({
    mode: z.string().min(1).optional(),
    referenceNumber: z.string().min(1).optional(),
    paidOn: z.string().optional(),
    note: z.string().optional(),
  }),
};

const confirmLastDay = {
  params: idParam,
  body: z.object({ lastWorkingDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the last working day') }),
};

const decide = { params: idParam, body: z.object({}).passthrough() };

const sendBack = {
  params: idParam,
  body: z.object({ note: z.string().trim().min(1, 'Say what needs changing').max(1000) }),
};

const byId = { params: idParam };

module.exports = { markPaid, confirmLastDay, decide, sendBack, byId };
