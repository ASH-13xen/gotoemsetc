const { z } = require('zod');
const { CMS_PLAN } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });

const setPlanPrices = {
  body: z.object({
    prices: z.array(
      z.object({
        plan: z.enum(Object.values(CMS_PLAN)),
        amount: z.coerce.number().min(0),
      })
    ),
  }),
};

const list = {
  query: z.object({
    status: z.string().optional(),
    year: z.coerce.number().optional(),
    month: z.coerce.number().optional(),
    clientId: z.string().optional(),
    plan: z.string().optional(),
  }),
};

const summary = list;

const generate = {
  body: z.object({
    year: z.coerce.number().int().min(2000).max(3000).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  }),
};

const markPaid = {
  params: idParam,
  body: z.object({
    mode: z.string().min(1).optional(),
    referenceNumber: z.string().min(1).optional(),
    paidOn: z.string().optional(),
    note: z.string().optional(),
  }),
};

module.exports = { idParam, setPlanPrices, list, summary, generate, markPaid };
