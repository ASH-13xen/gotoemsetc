const { z } = require('zod');
const { CMS_PLAN, CMS_CONTENT_TYPE } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const briefSchema = z.object({
  postingName: z.string().trim().optional(),
  postingLink: z.string().trim().optional(),
  collabsAndTags: z.string().trim().optional(),
  caption: z.string().trim().optional(),
  uploadDestination: z.string().trim().optional(),
  deliverableLink: z.string().trim().optional(),
});

const createCalendar = {
  body: z.object({
    client: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    // Both default to the client's current setting when omitted; either way
    // the value is snapshotted onto the calendar.
    plan: z.enum(Object.values(CMS_PLAN)).optional(),
    team: z.string().min(1).optional(),
    generateDailyStories: z.boolean().optional(),
  }),
};

const listCalendars = {
  query: z.object({ client: z.string().min(1) }),
};

const updateCalendar = {
  ...idParam,
  body: z.object({ team: z.string().min(1).optional() }),
};

const scheduleItem = {
  params: z.object({ calendarId: z.string().min(1) }),
  body: z
    .object({
      type: z.enum(Object.values(CMS_CONTENT_TYPE)),
      // Only meaningful (and required, enforced again in the service) when
      // type === 'festive_story' — which literal pipeline it follows.
      festiveWorkflow: z.enum(['post', 'reel']).optional(),
      scheduledDate: z.coerce.date(),
      assignments: z
        .object({
          designer: z.string().min(1).optional(),
          shooter: z.string().min(1).optional(),
          editor: z.string().min(1).optional(),
          contentManager: z.string().min(1).optional(),
        })
        .default({}),
      brief: briefSchema.optional(),
    }),
};

const updateBrief = { ...idParam, body: briefSchema };

const reschedule = { ...idParam, body: z.object({ scheduledDate: z.coerce.date() }) };

const reassign = {
  ...idParam,
  body: z
    .object({
      designer: z.string().min(1).optional(),
      shooter: z.string().min(1).optional(),
      editor: z.string().min(1).optional(),
      contentManager: z.string().min(1).optional(),
    })
    .refine((v) => v.designer || v.shooter || v.editor || v.contentManager, {
      message: 'Name at least one person to reassign',
    }),
};

const decision = { ...idParam, body: z.object({ note: z.string().trim().optional() }) };

const reject = {
  ...idParam,
  body: z.object({
    // Required, and enforced again in the service — a rejection with no
    // stated reason is unactionable for whoever has to redo the work.
    reason: z.string().trim().min(1),
  }),
};

const getOrDelete = { ...idParam };

module.exports = {
  createCalendar,
  listCalendars,
  updateCalendar,
  scheduleItem,
  updateBrief,
  reschedule,
  reassign,
  decision,
  reject,
  getOrDelete,
};
