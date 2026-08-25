const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const markPaid = {
  params: idParam,
  body: z.object({
    mode: z.string().min(1).optional(),
    referenceNumber: z.string().min(1).optional(),
    paidOn: z.string().optional(),
    note: z.string().optional(),
  }),
};

module.exports = { markPaid };
