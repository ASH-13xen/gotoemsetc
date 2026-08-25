const { z } = require('zod');
const { OFFICE_KEY } = require('../config/constants');

const assign = {
  params: z.object({ key: z.enum(Object.values(OFFICE_KEY)) }),
  body: z.object({
    // Omitted/null clears the key back to unassigned.
    employeeId: z.string().min(1).nullable().optional(),
  }),
};

module.exports = { assign };
