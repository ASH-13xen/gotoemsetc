const { z } = require('zod');

const applicantIdParam = z.object({ id: z.string().min(1) });
const interviewIdParams = z.object({ id: z.string().min(1), interviewId: z.string().min(1) });

const schedule = {
  params: applicantIdParam,
  body: z.object({
    scheduledAt: z.coerce.date(),
    notes: z.string().optional(),
  }),
};

const cancel = { params: interviewIdParams };

module.exports = { schedule, cancel };
