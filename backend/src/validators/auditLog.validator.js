const { z } = require('zod');

const list = {
  query: z.object({
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
    actorUsername: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
};

module.exports = { list };
