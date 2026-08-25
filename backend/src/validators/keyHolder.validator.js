const { z } = require('zod');
const { OFFICE_KEY } = require('../config/constants');

const assign = {
  params: z.object({ key: z.enum(Object.values(OFFICE_KEY)) }),
  body: z.object({
    // Replaces the full holder list for this key. Empty/omitted clears it
    // back to unassigned.
    employeeIds: z.array(z.string().min(1)).optional().default([]),
  }),
};

module.exports = { assign };
