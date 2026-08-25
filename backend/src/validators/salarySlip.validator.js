const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const generate = {
  params: idParam,
  body: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    incomeTaxDeduction: z.coerce.number().optional(),
    professionTax: z.coerce.number().optional(),
    pf: z.coerce.number().optional(),
    otherDeduction3: z.coerce.number().optional(),
    compensationOff: z.coerce.number().optional(),
    incentives: z.coerce.number().optional(),
    travelAllowance: z.coerce.number().optional(),
    otherEarning1: z.coerce.number().optional(),
    reimbursement1: z.coerce.number().optional(),
    reimbursement2: z.coerce.number().optional(),
  }),
};

const listForEmployee = { params: idParam };

const getOrDelete = { params: idParam };

const recentMonths = { params: idParam };

const ownFile = { params: z.object({ id: z.string().min(1), slipId: z.string().min(1) }) };

const generateBulk = {
  body: z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(3000),
  }),
};

const bulkZip = {
  body: z.object({
    slipIds: z.array(z.string().min(1)).min(1, 'No salary slips to zip'),
    filename: z.string().optional(),
  }),
};

const listForFinance = {
  query: z.object({
    year: z.coerce.number().int().min(2000).max(3000),
    month: z.coerce.number().int().min(1).max(12),
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

module.exports = {
  generate,
  listForEmployee,
  getOrDelete,
  recentMonths,
  ownFile,
  generateBulk,
  bulkZip,
  listForFinance,
  markPaid,
};
