const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const list = {
  query: z.object({
    unreadOnly: z.coerce.boolean().optional(),
  }),
};

const markRead = { params: idParam };

module.exports = { list, markRead };
