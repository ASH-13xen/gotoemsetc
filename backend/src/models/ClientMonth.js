const { Schema, model } = require('mongoose');

// What one client is owed in one month — the client card's counts (reels,
// posts, stories, festive stories), the Organisation chart team that does the
// work and its people — and the tickets made from it (each carries
// deliverable.clientMonth). A plan carries on until it is changed: each new
// month starts as a copy of the latest one (services/clientWork.service.js#
// rollMonth), unless the client is paused.
const clientMonthSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', required: true, index: true },
    month: { type: String, required: true }, // "2026-11", the IST civil month
    counts: {
      reels: { type: Number, default: 0, min: 0 },
      posts: { type: Number, default: 0, min: 0 },
      stories: { type: Number, default: 0, min: 0 },
      festiveStories: { type: Number, default: 0, min: 0 },
    },
    // The team box (OrgNode kind 'team') and the people the tickets go to.
    team: { type: Schema.Types.ObjectId, ref: 'OrgNode', default: null },
    teamName: { type: String, trim: true },
    smm: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    // Posts: the team's Graphic Designer (the Social Media Manager when none).
    designer: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    shooter: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    editor: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    contentManager: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    // Everyone in each role for this client — a team can have more than one
    // Social Media Manager, videographer… The month's tickets are shared
    // between them in turn (clientWork.service.js#peopleFor). The single
    // fields above hold the first of each, and stand in for a month saved
    // before these lists existed.
    people: {
      smm: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
      designer: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
      shooter: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
      editor: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
      contentManager: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    },
    // What the client pays for the month when there is no invoice for it in
    // the system — for the client value report (CEO/admin only).
    fee: { type: Number, default: null, min: 0 },
    // Set once its tickets have been made (and again on every later sync).
    generatedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

clientMonthSchema.index({ client: 1, month: 1 }, { unique: true });
clientMonthSchema.index({ month: 1 });

module.exports = model('ClientMonth', clientMonthSchema);
