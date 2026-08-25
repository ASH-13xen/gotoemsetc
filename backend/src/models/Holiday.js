const { Schema, model } = require('mongoose');

// Company-wide — one admin action affects every employee's calendar and
// payroll calculations. Sundays are always implicitly off and never need a
// record here; this is only for *additional* admin-marked off days.
const holidaySchema = new Schema(
  {
    date: { type: Date, required: true, unique: true, index: true }, // normalized to midnight, day-only
    label: { type: String, required: true, trim: true },
    // 'half_day' upgrades anyone who scanned at all (arrival within grace,
    // or later) to a full-day Present, since the whole day is only meant to
    // be half a day anyway — see
    // attendanceClassifier.service.js#applyHalfDayForEmployee. 'sl_day' is a
    // narrower cousin for an otherwise-normal working day: only an arrival
    // that would already classify as Short-Leave-or-better gets forgiven up
    // to Present — a Half-Day-territory arrival stays exactly as harsh as
    // any ordinary day — see #applySlDayForEmployee. Plain 'holiday'
    // unconditionally writes Holiday to everyone regardless of scans.
    type: { type: String, enum: ['holiday', 'half_day', 'sl_day'], default: 'holiday' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = model('Holiday', holidaySchema);
