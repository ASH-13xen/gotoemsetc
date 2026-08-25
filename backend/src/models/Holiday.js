const { Schema, model } = require('mongoose');

// Company-wide — one admin action affects every employee's calendar and
// payroll calculations. Sundays are always implicitly off and never need a
// record here; this is only for *additional* admin-marked off days.
const holidaySchema = new Schema(
  {
    date: { type: Date, required: true, unique: true, index: true }, // normalized to midnight, day-only
    label: { type: String, required: true, trim: true },
    // 'half_day' upgrades anyone who scanned at all to a full-day Present
    // (see attendanceClassifier.service.js#applyHalfDayForEmployee) instead
    // of unconditionally writing Holiday to everyone.
    type: { type: String, enum: ['holiday', 'half_day'], default: 'holiday' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = model('Holiday', holidaySchema);
