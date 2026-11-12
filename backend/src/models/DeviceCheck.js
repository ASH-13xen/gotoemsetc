const { Schema, model } = require('mongoose');
const { CHECK_KIND, CHECK_STATUS, GRADES } = require('../utils/deviceCatalog');

// A device's condition, storage, battery, security settings and apps, as found
// at one moment — at handover, at return, every month (the holder fills it in,
// HR verifies it), or whenever HR looks. Kept forever, so damage can be traced
// to the spell it happened in.
const deviceCheckSchema = new Schema(
  {
    device: { type: Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    assignment: { type: Schema.Types.ObjectId, ref: 'DeviceAssignment', default: null },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null }, // the holder at the time
    kind: { type: String, enum: Object.values(CHECK_KIND), required: true },
    // A holder's own check waits for HR; HR's own checks are verified as made.
    status: { type: String, enum: Object.values(CHECK_STATUS), default: CHECK_STATUS.SUBMITTED, index: true },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byHolder: { type: Boolean, default: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, trim: true },
    // For a monthly check: the month it is for, e.g. "2026-11".
    month: { type: String },

    grade: { type: String, enum: [...GRADES, null], default: null },
    parts: { type: Map, of: String, default: {} }, // part key -> ok | worn | damaged | missing
    storageTotalGb: Number,
    storageFreeGb: Number,
    batteryHealth: Number, // %
    security: { type: Map, of: Boolean, default: {} }, // security item key -> on?
    apps: [{ _id: false, key: String, installed: Boolean, loggedIn: Boolean, account: String }],
    galleryBackedUp: Boolean,
    photos: [{ type: Schema.Types.ObjectId, ref: 'DeviceFile' }],
    remarks: { type: String, trim: true },
    // What stood out, worked out on save (device.service.js#flagsFor).
    flags: [String],
  },
  { timestamps: true }
);

deviceCheckSchema.index({ device: 1, createdAt: -1 });

module.exports = model('DeviceCheck', deviceCheckSchema);
