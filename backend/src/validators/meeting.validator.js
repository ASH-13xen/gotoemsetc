const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const create = {
  params: idParam,
  body: z.object({
    mom: z.string().min(1),
    meetingDate: z.coerce.date(),
    attendees: z.array(z.string().min(1)).optional(),
  }),
};

const listForClient = { params: idParam };

module.exports = { create, listForClient };
