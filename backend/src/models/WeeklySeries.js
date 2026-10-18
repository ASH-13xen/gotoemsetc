const { Schema, model } = require('mongoose');
const { WEEKLY_EVENT_CATEGORY, WEEKLY_INVITE_STATUS, WEEKLY_REPEAT } = require('../config/constants');

// The rule behind a repeating Weekly Calendar event — every week, every
// month or every year, until the host stops it. Its dates are ordinary
// WeeklyEvents (their `series` is this _id), created a year ahead (three for
// yearly); a nightly job keeps adding dates as time moves on
// (weeklyCalendar.service#extendRepeats). This doc is what each new date is
// copied from, and it remembers each guest's answer for the whole series.

// One repeating time: the first date it happens on, and its hours. A
// series made from several picked times (Mon and Wed) has one per time.
const slotSchema = new Schema(
  {
    anchorDay: { type: String, required: true }, // YYYY-MM-DD
    startMin: { type: Number, required: true },
    endMin: { type: Number, required: true },
  },
  { _id: false }
);

// The meeting's time slices, as minutes from its start — so they fit every
// date whatever its hours.
const sliceSchema = new Schema(
  {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    label: { type: String, trim: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const attendeeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(WEEKLY_INVITE_STATUS), default: WEEKLY_INVITE_STATUS.INVITED },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
  },
  { _id: false }
);

const weeklySeriesSchema = new Schema(
  {
    repeat: { type: String, enum: Object.values(WEEKLY_REPEAT), required: true },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: Object.values(WEEKLY_EVENT_CATEGORY), default: WEEKLY_EVENT_CATEGORY.OTHER },
    isPersonal: { type: Boolean, default: false },
    openForAll: { type: Boolean, default: false },
    location: { type: String, trim: true },
    link: { type: String, trim: true },

    slots: [slotSchema],
    slices: [sliceSchema],
    attendees: [attendeeSchema],

    // Dates exist up to and including this day.
    generatedUntil: { type: String, required: true },
    endedAt: { type: Date },
    endedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

weeklySeriesSchema.index({ endedAt: 1, generatedUntil: 1 });

module.exports = model('WeeklySeries', weeklySeriesSchema);
