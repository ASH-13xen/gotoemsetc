const { z } = require('zod');
const { MEETING_TYPE } = require('../config/constants');

const applicantIdParam = z.object({ id: z.string().min(1) });
const interviewIdParams = z.object({ id: z.string().min(1), interviewId: z.string().min(1) });

const schedule = {
  params: applicantIdParam,
  body: z.object({
    scheduledAt: z.coerce.date(),
    meetingType: z.enum(Object.values(MEETING_TYPE)),
    location: z.string().optional(),
    meetingLink: z.string().optional(),
    notes: z.string().optional(),
  }),
};

const cancel = { params: interviewIdParams };

module.exports = { schedule, cancel };
