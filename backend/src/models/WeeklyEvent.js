const { Schema, model } = require('mongoose');
const { WEEKLY_EVENT_CATEGORY, WEEKLY_INVITE_STATUS, WEEKLY_NOTE_KIND } = require('../config/constants');

// One block on the Weekly Calendar — a meeting, an event or a personal
// block, on one day. Everyone in it is a User (not an Employee): the CEO,
// HR and admin logins have no employee record but still keep a calendar.
//
// Whose time it holds: the host, plus every attendee who has accepted.
// A pending invite is only "tentative" — it never blocks anyone's slot.
// See weeklyCalendar.service.js for every rule.

const attendeeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(WEEKLY_INVITE_STATUS), default: WEEKLY_INVITE_STATUS.INVITED },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    reason: { type: String, trim: true }, // optional, on decline
  },
  { _id: false }
);

// A slice of the meeting given to one person — e.g. the Co-ordinators
// Meeting's 15 minutes each.
const segmentSchema = new Schema({
  startMin: { type: Number, required: true },
  endMin: { type: Number, required: true },
  label: { type: String, trim: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
});

// Shared meeting notes — anyone in the meeting can add and edit them, and
// every edit keeps the previous text with who changed it.
const noteSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(WEEKLY_NOTE_KIND), default: WEEKLY_NOTE_KIND.NOTE },
    text: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    history: [
      {
        _id: false,
        text: { type: String },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
    // Action items only.
    assignee: { type: Schema.Types.ObjectId, ref: 'User' },
    dueDay: { type: String }, // YYYY-MM-DD
    done: { type: Boolean, default: false },
    task: { type: Schema.Types.ObjectId, ref: 'EmployeeTask' },
  },
  { timestamps: true }
);

const weeklyEventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: Object.values(WEEKLY_EVENT_CATEGORY), default: WEEKLY_EVENT_CATEGORY.OTHER },
    // Only the owner (and admin) see what it is; everyone else sees "Busy".
    isPersonal: { type: Boolean, default: false },
    // Published to everyone without invites — anyone can join.
    openForAll: { type: Boolean, default: false },
    location: { type: String, trim: true },
    link: { type: String, trim: true },

    day: { type: String, required: true }, // YYYY-MM-DD (IST calendar day)
    startMin: { type: Number, required: true },
    endMin: { type: Number, required: true },

    host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attendees: [attendeeSchema],

    // Occurrences created together (several days at once, or repeated
    // weekly) share a series id, so they can be edited/cancelled together.
    series: { type: Schema.Types.ObjectId, index: true },

    segments: [segmentSchema],
    notes: [noteSchema],

    reminderSentAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true }
);

weeklyEventSchema.index({ day: 1, host: 1 });
weeklyEventSchema.index({ day: 1, 'attendees.user': 1 });
weeklyEventSchema.index({ day: 1, openForAll: 1 });

module.exports = model('WeeklyEvent', weeklyEventSchema);
