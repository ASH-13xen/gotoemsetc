const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const create = {
  body: z.object({
    name: z.string().min(1),
    amount: z.coerce.number().min(0),
    dueDay: z.coerce.number().int().min(1).max(31),
  }),
};

const setActive = {
  params: idParam,
  body: z.object({ isActive: z.boolean() }),
};

const markPaid = {
  params: z.object({ id: z.string().min(1), instanceId: z.string().min(1) }),
  body: z.object({
    mode: z.string().min(1).optional(),
    referenceNumber: z.string().min(1).optional(),
    paidOn: z.string().optional(),
    note: z.string().optional(),
  }),
};

module.exports = { create, setActive, markPaid };
