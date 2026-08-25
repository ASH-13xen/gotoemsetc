const { Schema, model } = require('mongoose');
const { CMS_CONTENT_TYPE } = require('../config/constants');

// The content brief. Every field is optional and fillable later — the spec is
// explicit that a piece can be scheduled first and described afterwards.
// deliverableLink is where the finished work lands: a plain string (a Drive
// link, a Figma URL) rather than an upload, so nothing here handles files.
const briefSchema = new Schema(
  {
    postingName: { type: String, trim: true },
    postingLink: { type: String, trim: true },
    collabsAndTags: { type: String, trim: true },
    caption: { type: String, trim: true },
    uploadDestination: { type: String, trim: true },
    deliverableLink: { type: String, trim: true },
  },
  { _id: false }
);

// Append-only audit of every stage transition, including who really acted —
// admin/CEO may force-complete a step that isn't really theirs, and that
// distinction has to survive in the record.
const stageHistorySchema = new Schema(
  {
    from: { type: String },
    to: { type: String, required: true },
    action: { type: String, required: true }, // advance | send_back | reject
    byUser: { type: Schema.Types.ObjectId, ref: 'User' },
    byEmployee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    // Set when the actor held the authority by the admin/CEO force-complete
    // override rather than by actually holding the step's named role.
    onBehalfOf: { type: String },
    note: { type: String, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const calendarItemSchema = new Schema(
  {
    calendar: { type: Schema.Types.ObjectId, ref: 'ClientCalendar', required: true, index: true },
    // Denormalised from the calendar so cross-month queries ("everything for
    // this client") don't need a join.
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', required: true, index: true },

    type: { type: String, enum: Object.values(CMS_CONTENT_TYPE), required: true },
    // Only meaningful when type === 'festive_story': which literal pipeline
    // (post's or reel's) this festive story follows, chosen once by whoever
    // schedules it. Null for every other type.
    festiveWorkflow: { type: String, enum: ['post', 'reel', null], default: null },
    // Per calendar, per type — "POST #1". Resets every month, by design:
    // the number is a within-month label, not a lifetime identifier.
    index: { type: Number, required: true },

    // The UTC instant of 18:30 IST on the scheduled day (see utils/istDate.js).
    // Scheduling into the past is allowed — backfilling is an explicit
    // requirement — so this may precede the parent task's startAt.
    scheduledDate: { type: Date, required: true, index: true },

    brief: { type: briefSchema, default: () => ({}) },

    // A post has a designer (the assigned SMM); a reel has a shooter
    // (videographer), an editor, and a content manager; stories are routed
    // to the team's tagged social media manager(s) collectively at creation,
    // with no single assignee stored here.
    assignments: {
      designer: { type: Schema.Types.ObjectId, ref: 'Employee' },
      shooter: { type: Schema.Types.ObjectId, ref: 'Employee' },
      editor: { type: Schema.Types.ObjectId, ref: 'Employee' },
      contentManager: { type: Schema.Types.ObjectId, ref: 'Employee' },
    },

    // The Task Management records this item drives. The item owns scheduling,
    // brief, and pipeline stage; the tasks own execution. Status is read live
    // off the tasks rather than mirrored here, so completing work in Task
    // Management is immediately visible on the calendar.
    task: { type: Schema.Types.ObjectId, ref: 'EmployeeTask', index: true },
    subtaskRefs: {
      design: { type: Schema.Types.ObjectId, ref: 'EmployeeTask' },
      shoot: { type: Schema.Types.ObjectId, ref: 'EmployeeTask' }, // videographer's subtask
      edit: { type: Schema.Types.ObjectId, ref: 'EmployeeTask' },
      contentManager: { type: Schema.Types.ObjectId, ref: 'EmployeeTask' },
    },

    // Which literal step of its pipeline (config/cmsPipelines.js) this item
    // is at. Every pipeline's first step is the literal string 'created', so
    // this default is unambiguous across all three. No stage-enum validation
    // here — which values are legal depends on `type`/`festiveWorkflow`,
    // checked by cmsWorkflow.service.js, not the schema.
    stage: { type: String, default: 'created', index: true },

    // Pink and red — universal overrides layered on top of whatever step the
    // item is currently at, not steps of their own, exactly like the old
    // engine's single isRejected flag worked. Pink is transient (cleared the
    // next time the step it sent back to is completed forward again); red is
    // terminal — it closes the item for everyone.
    isSentBack: { type: Boolean, default: false },
    isRejected: { type: Boolean, default: false },
    lastRejection: {
      fromStage: { type: String },
      reason: { type: String, trim: true },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },

    stageHistory: [stageHistorySchema],

    // Stamped when the item reaches its pipeline's terminal step (cream for
    // post/reel, teal for a daily story). This is what the "delivered"
    // counter and the month-end report count.
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },

    // Stamped on the first advance out of `created`, so the report can
    // measure turnaround without replaying stageHistory.
    submittedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Backs the per-type numbering and the sidebar counters.
calendarItemSchema.index({ calendar: 1, type: 1, isDeleted: 1 });

module.exports = model('CalendarItem', calendarItemSchema);
