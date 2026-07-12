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

module.exports = { generate, listForEmployee, getOrDelete };
