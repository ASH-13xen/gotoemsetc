const { Schema, model } = require('mongoose');
const {
  EMPLOYEE_TASK_TYPE,
  EMPLOYEE_TASK_STATUS,
  EMPLOYEE_TASK_COMPLETION_FLAG,
  CMS_TASK_ROLE,
  MOM_PIPELINE_KIND,
} = require('../config/constants');

// Only set on a type:'client' task spawned from a meeting's "any more tasks
// required?" step when the creator picked Pipeline — Post/Reel-style or
// Custom. Deliberately off-calendar: no ClientCalendar/CalendarItem
// involved, no quota impact, never appears on the calendar grid. Reuses the
// same colours/steps/actor logic as the real pipeline engine — see
// utils/momPipeline.js.
const momPipelineSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(MOM_PIPELINE_KIND), required: true },
    stage: { type: String, default: 'created' },
    assignments: {
      designer: { type: Schema.Types.ObjectId, ref: 'Employee' },
      shooter: { type: Schema.Types.ObjectId, ref: 'Employee' },
      editor: { type: Schema.Types.ObjectId, ref: 'Employee' },
      contentManager: { type: Schema.Types.ObjectId, ref: 'Employee' },
    },
    // 'custom' kind only — 2-5 user-defined steps, each with its own colour
    // and a single directly-assigned actor (team or outside).
    customSteps: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true, trim: true },
        color: { type: String, required: true },
        assignee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
      },
    ],
    isSentBack: { type: Boolean, default: false },
    isRejected: { type: Boolean, default: false },
    lastRejection: {
      fromStage: { type: String },
      reason: { type: String, trim: true },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },
    stageHistory: [
      {
        from: { type: String },
        to: { type: String, required: true },
        action: { type: String, required: true }, // advance | send_back | reject
        byUser: { type: Schema.Types.ObjectId, ref: 'User' },
        byEmployee: { type: Schema.Types.ObjectId, ref: 'Employee' },
        onBehalfOf: { type: String },
        note: { type: String, trim: true },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { _id: false }
);

const resourceRequiredSchema = new Schema(
  { label: { type: String, required: true, trim: true }, notes: { type: String, trim: true } },
  { _id: false }
);

const contactRequiredSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

// Keeps its own _id (default) so a single follow-up can be individually
// toggled/removed. reminderSentAt guards employeeTaskFollowUpReminder.job.js
// from re-sending once a reminder has already gone out for this entry.
const followUpSchema = new Schema(
  {
    note: { type: String, trim: true },
    followUpAt: { type: Date, required: true },
    isDone: { type: Boolean, default: false },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    reminderSentAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const employeeTaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: { type: String, enum: Object.values(EMPLOYEE_TASK_TYPE), required: true },

    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },

    // Exactly 1 for a Personal task; for a subtask of a team/client/event
    // task, the specific people it's delegated to. Left empty on top-level
    // team/client/event tasks — their assignee set is the *live*
    // team.members ∪ extraMembers, not a duplicated snapshot, since team
    // rosters are editable after the fact (see taskAccess.js#isAssignee).
    assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],

    team: { type: Schema.Types.ObjectId, ref: 'WorkTeam' }, // required: team/client/event
    extraMembers: [{ type: Schema.Types.ObjectId, ref: 'Employee' }], // ad-hoc, team/client/event only
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient' }, // required: type=client
    event: { type: Schema.Types.ObjectId, ref: 'TaskEvent' }, // required: type=event

    resourcesRequired: [resourceRequiredSchema],
    contactsRequired: [contactRequiredSchema],
    followUps: [followUpSchema],

    // Subtasks, one level deep — enforced in employeeTask.service.js, not
    // here (a self-ref can't cheaply assert its own parent has no parent).
    parentTask: { type: Schema.Types.ObjectId, ref: 'EmployeeTask', default: null, index: true },

    // Off by default — when true, the normal pending → for_review →
    // completed handoff applies; when false, the assignee/leader completes
    // the task directly (see taskAccess.js#canMarkCompletedDirect), skipping
    // the review checkpoint entirely.
    reviewMandatory: { type: Boolean, default: false },

    status: {
      type: String,
      enum: Object.values(EMPLOYEE_TASK_STATUS),
      default: EMPLOYEE_TASK_STATUS.PENDING,
    },
    markedForReviewAt: { type: Date },
    markedForReviewBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    // Stamped once, at the moment status flips to for_review (or, for a
    // review-optional task, at the moment it's completed directly),
    // comparing against endAt — never recomputed later, so a delayed
    // admin/lead sign-off doesn't retroactively change the color.
    completionFlag: { type: String, enum: Object.values(EMPLOYEE_TASK_COMPLETION_FLAG) },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },

    // Chronological continuation — distinct from parentTask (subtask
    // hierarchy). Set when this task was created as a "do more of this"
    // follow-on to an already-completed task/subtask (see
    // employeeTask.service.js#createContinuation). The two relationships
    // are independent: a subtask can itself be continued, carrying its own
    // parentTask forward from the original.
    continuesFrom: { type: Schema.Types.ObjectId, ref: 'EmployeeTask', default: null, index: true },

    // ---- Client Management System linkage (type: client only) ----
    // Set when this task was generated from a CMS content calendar. Its
    // presence is what makes a task "CMS-owned": such tasks can't be created
    // or deleted directly in Task Management, since doing so would produce
    // client work that no calendar counts and no plan accounts for. See
    // taskAccess.middleware.js.
    cmsItem: { type: Schema.Types.ObjectId, ref: 'CalendarItem', index: true },
    // Set instead of cmsItem on the one shared "Daily Stories — <Month>"
    // parent, which spans the whole month rather than a single calendar item
    // (each day is a subtask of it). Also marks the task CMS-owned.
    cmsCalendar: { type: Schema.Types.ObjectId, ref: 'ClientCalendar', index: true },
    // Set when this task was spawned from a meeting's MOM instead — see
    // Meeting.js#spawnedTasks and meeting.service.js#addTaskFromMom. Also
    // marks the task on personal/team MOM-spawned tasks (momPipeline stays
    // unset for those), purely for traceability back into the manual.
    meetingRef: { type: Schema.Types.ObjectId, ref: 'Meeting', index: true },
    momPipeline: momPipelineSchema,
    // Which piece of the deliverable this is — a post has one design
    // subtask, a reel has a videographer/editor/content-manager subtask
    // each, a story has one.
    cmsRole: { type: String, enum: [...Object.values(CMS_TASK_ROLE), null], default: null },

    // Hard dependency: this task can't be started or submitted until the
    // referenced task is completed. Used for a reel's chain (editor waits on
    // videographer, content manager waits on editor). Distinct from
    // parentTask (hierarchy) and continuesFrom (chronology) — neither of
    // those blocks anything.
    blockedBy: { type: Schema.Types.ObjectId, ref: 'EmployeeTask', default: null },

    // Where the finished work lives — a link, not an upload, per spec.
    deliverableLink: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

employeeTaskSchema.index({ type: 1, status: 1 });
employeeTaskSchema.index({ team: 1 });
employeeTaskSchema.index({ client: 1 });
employeeTaskSchema.index({ event: 1 });
employeeTaskSchema.index({ assignedEmployees: 1 });

module.exports = model('EmployeeTask', employeeTaskSchema);
