const { Schema, model } = require('mongoose');
const { CMS_PLAN } = require('../config/constants');

// A quota as committed for one month. `label` is the string the UI shows as
// the counter's denominator ("6", "6-8") — several tiers are ranges, not
// numbers, so it is deliberately never resolved to a single figure. min/max
// exist only for the month-end report's fulfilment maths.
const quotaSchema = new Schema(
  {
    label: { type: String, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false }
);

// Frozen at month close (see cmsReport.service.js). Deliberately a stored
// snapshot rather than something recomputed on read: a calendar edited in
// September must not rewrite what August's fulfilment turned out to be.
const reportSchema = new Schema(
  {
    generatedAt: { type: Date },
    perType: [
      new Schema(
        {
          type: { type: String, required: true },
          committedLabel: { type: String },
          scheduled: { type: Number, default: 0 },
          published: { type: Number, default: 0 },
          onTime: { type: Number, default: 0 },
          late: { type: Number, default: 0 },
          unpublished: { type: Number, default: 0 },
        },
        { _id: false }
      ),
    ],
    rejectionsByStage: { type: Map, of: Number, default: {} },
    // Mean hours from "submitted for approval" to final client sign-off,
    // across items that got there. Null when nothing completed the pipeline.
    avgApprovalHours: { type: Number, default: null },
    neverPublished: [{ type: Schema.Types.ObjectId, ref: 'CalendarItem' }],
  },
  { _id: false }
);

// One per client per month — the unit a plan is committed and reported
// against. Created explicitly ("make me an August calendar"), never
// implicitly: a month with no calendar means no work is owed, including no
// daily stories.
const clientCalendarSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', required: true, index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 }, // 1-based, IST civil month

    // Snapshots taken at creation from TaskClient.currentPlan/defaultTeam.
    // Changing the client's plan in March must not retroactively rewrite what
    // February was committed at, and reassigning the client to another team
    // must not orphan a month already in flight.
    plan: { type: String, enum: Object.values(CMS_PLAN), required: true },
    quotas: {
      posts: { type: quotaSchema, required: true },
      reels: { type: quotaSchema, required: true },
      dailyStoriesPerDay: { type: quotaSchema, required: true },
      festiveStories: { type: quotaSchema, required: true },
    },
    team: { type: Schema.Types.ObjectId, ref: 'WorkTeam', required: true },

    // The single "Daily Stories — <Month> <Year>" task every day of this
    // month hangs off as a subtask. Daily stories are one continuous
    // responsibility for the social media manager, not 31 unrelated jobs, so
    // Task Management shows one card with a subtask per day rather than
    // flooding the board.
    dailyStoryTask: { type: Schema.Types.ObjectId, ref: 'EmployeeTask', default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    closedAt: { type: Date },
    report: reportSchema,

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One calendar per client per month. Partial so soft-deleted calendars don't
// block re-creating the same month.
clientCalendarSchema.index(
  { client: 1, year: 1, month: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

module.exports = model('ClientCalendar', clientCalendarSchema);
