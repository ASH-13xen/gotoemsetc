const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });
const meetingIdParam = z.object({ id: z.string().min(1), meetingId: z.string().min(1) });

const create = {
  params: idParam,
  body: z.object({
    topic: z.string().min(1),
    agenda: z.string().optional(),
    meetingDate: z.coerce.date(),
    attendees: z.array(z.string().min(1)).optional(),
  }),
};

const listForClient = { params: idParam };

const updateMinutes = {
  params: meetingIdParam,
  body: z.object({ mom: z.string().min(1) }),
};

module.exports = { create, listForClient, updateMinutes };
