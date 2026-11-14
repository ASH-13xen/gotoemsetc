const { Schema, model } = require('mongoose');
const { TICKET_PIPELINE, TICKET_PRIORITY, TICKET_STATUS } = require('../config/constants');

// A ticket — Task Management's unit of work (see services/ticket.service.js).
// It is raised by someone for a person in their own box or below in the
// Organisation chart, follows one pipeline (utils/ticketPipeline.js), and
// takes the colour of whichever step it is at, exactly as the content
// calendar does. Everything that happens to it is written, timestamped, to
// TicketEvent — that record, not this document, is the history.

const customStepSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, required: true },
    assignee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  },
  { _id: false }
);

const linkSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    label: { type: String, trim: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketSchema = new Schema(
  {
    // TKT-0001 — sequential, never reused.
    number: { type: Number, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: String, enum: Object.values(TICKET_PRIORITY), default: TICKET_PRIORITY.NORMAL },
    dueAt: { type: Date, required: true },
    // Typed, since Client Management (and its client registry) is switched off.
    clientName: { type: String, trim: true },

    pipeline: { type: String, enum: Object.values(TICKET_PIPELINE), required: true },
    // Story/Post/Reel: the Organisation chart team box whose Social Media
    // Manager / Content Manager boxes act on the team steps.
    team: { type: Schema.Types.ObjectId, ref: 'OrgNode', default: null },
    teamName: { type: String, trim: true },
    // Story/Post/Reel: the team's Social Media Manager this ticket is for —
    // the SMM steps go to them only, and a reel's Videographer and Editor are
    // that SMM's own.
    smm: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    // Post/Reel: who does each named step, picked when the ticket is raised.
    assignments: {
      designer: { type: Schema.Types.ObjectId, ref: 'Employee' },
      shooter: { type: Schema.Types.ObjectId, ref: 'Employee' },
      editor: { type: Schema.Types.ObjectId, ref: 'Employee' },
      contentManager: { type: Schema.Types.ObjectId, ref: 'Employee' },
      // Work pipelines: the Social Media Manager who approves posts and uploads.
      smm: { type: Schema.Types.ObjectId, ref: 'Employee' },
    },
    // General: who approves and closes it — the raiser unless someone is chosen.
    approver: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    // General, when the approver is a login with no employee record (the CEO,
    // admin): they approve it as that login.
    approverUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // Made from a client's plan and not started yet: on nobody's board, no
    // time counting, until the Content Manager, Team Lead, CEO or admin
    // starts it (and sets its due date).
    locked: { type: Boolean, default: false, index: true },
    // Waiting between phases, nobody holding it: 'shoot' | 'editing' |
    // 'calendar' (lineups), 'posting' (scheduled — until parkedUntil), 'hold'.
    parkedIn: { type: String, default: null, index: true },
    parkedUntil: { type: Date, default: null },
    parkNote: { type: String, trim: true },
    // The posting date, once scheduled.
    scheduledFor: { type: Date, default: null },
    customSteps: [customStepSchema],

    // A client's deliverable (services/clientWork.service.js): made from the
    // client's month — "Reel 3 of November" — and counted against it.
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', default: null, index: true },
    deliverable: {
      clientMonth: { type: Schema.Types.ObjectId, ref: 'ClientMonth', default: null },
      month: { type: String }, // "2026-11"
      type: { type: String }, // reels | posts | stories | festiveStories
      index: { type: Number },
      // Taken off the plan when the month's count was lowered (never started).
      removed: { type: Boolean, default: false },
      // Made by hand beyond the month's count ("9 of 8 reels") — not taken
      // off when the plan is saved; taken into the count if it is raised.
      extra: { type: Boolean, default: false },
    },
    // Still open when its month ended — it moves on, flagged, and still
    // counts against the month it was for.
    carriedOver: { type: Boolean, default: false },
    // Raised by a repeat (models/TicketRepeat.js) — each date's copy, and the first one.
    repeat: { type: Schema.Types.ObjectId, ref: 'TicketRepeat', default: null, index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raisedByEmployee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    raisedFor: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    // Which step it is at — 'created' to start with, for every pipeline.
    stage: { type: String, default: 'created' },
    // Pink (sent back) and red (rejected) are overrides on top of the step's
    // own colour, never steps of their own — same as the content calendar.
    isSentBack: { type: Boolean, default: false },
    isRejected: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(TICKET_STATUS), default: TICKET_STATUS.OPEN, index: true },

    links: [linkSchema],

    completedAt: { type: Date },
    rejectedAt: { type: Date },
    // Stamped once, when the due date passes while the ticket is still open.
    overdueAt: { type: Date },
    submittedToCeoAt: { type: Date, index: true },
    ceoReviewedAt: { type: Date },
    ceoReviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    ceoReviewNote: { type: String, trim: true },

    // Running figures for analysis, updated at every move: milliseconds spent
    // at each step (keyed by stage), how often it was sent back, and when it
    // last moved.
    metrics: {
      stepMs: { type: Map, of: Number, default: () => new Map() },
      reverts: { type: Number, default: 0 },
      lastMovedAt: { type: Date },
    },
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, dueAt: 1 });
ticketSchema.index({ raisedBy: 1, createdAt: -1 });
ticketSchema.index({ 'deliverable.clientMonth': 1, 'deliverable.type': 1 });

ticketSchema.virtual('code').get(function code() {
  return `TKT-${String(this.number).padStart(4, '0')}`;
});
ticketSchema.set('toJSON', { virtuals: true });
ticketSchema.set('toObject', { virtuals: true });

module.exports = model('Ticket', ticketSchema);
