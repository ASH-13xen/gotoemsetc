const { Schema, model } = require('mongoose');
const { DEVICE_KIND, DEVICE_OS, DEVICE_STATUS, GRADES } = require('../utils/deviceCatalog');

// One company device — phone, laptop, tablet — whoever has it (HR Work →
// Devices, services/device.service.js). `holder` and `assignment` say who has
// it right now; DeviceAssignment keeps everyone who ever had it. The
// `condition` block is a copy of the latest check's findings, so the register
// can show and filter on them without loading every check.
const deviceSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true }, // e.g. PH-001
    kind: { type: String, enum: Object.values(DEVICE_KIND), required: true },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    // As an iPhone shows them in Settings → General → About (Android: About phone).
    modelNumber: { type: String, trim: true },
    os: { type: String, enum: [...DEVICE_OS, null], default: null },
    osVersion: { type: String, trim: true },
    color: { type: String, trim: true },
    imei1: { type: String, trim: true },
    imei2: { type: String, trim: true },
    meid: { type: String, trim: true },
    iccid: { type: String, trim: true }, // the SIM card's number
    eid: { type: String, trim: true }, // the eSIM's number
    serialNumber: { type: String, trim: true },
    storageGb: Number,
    simNumber: { type: String, trim: true },
    simProvider: { type: String, trim: true },
    purchaseDate: Date,
    purchasePrice: Number,
    // What is recovered if it is lost while with someone — the purchase price
    // unless HR sets otherwise (e.g. after depreciation).
    recoveryValue: Number,
    vendor: { type: String, trim: true },
    warrantyUntil: Date,
    notes: { type: String, trim: true },

    status: { type: String, enum: Object.values(DEVICE_STATUS), default: DEVICE_STATUS.AVAILABLE, index: true },
    holder: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    assignment: { type: Schema.Types.ObjectId, ref: 'DeviceAssignment', default: null },

    // The latest check, copied (see device.service.js#applyCheckToDevice).
    lastCheck: { type: Schema.Types.ObjectId, ref: 'DeviceCheck', default: null },
    condition: {
      grade: { type: String, enum: [...GRADES, null], default: null },
      storageFreePct: Number,
      batteryHealth: Number,
      damaged: [String], // part keys rated damaged or missing
      securityOff: [String], // security item keys not on
      appsMissing: [String], // required app keys not installed / logged in
      unknownParts: [String], // iPhone parts shown as "Unknown Part"
      locationOff: [String], // location item keys not on
      at: Date,
    },
    // HR saw the device on the map (Google Maps location sharing / Find My).
    locationVerified: {
      at: Date,
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      note: { type: String, trim: true },
    },
    // Each app's state on this device, as last checked.
    apps: [{ _id: false, key: String, installed: Boolean, loggedIn: Boolean, account: String }],

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lostAt: Date,
    retiredAt: Date,
  },
  { timestamps: true }
);

deviceSchema.index({ imei1: 1 }, { sparse: true });
deviceSchema.index({ serialNumber: 1 }, { sparse: true });

module.exports = model('Device', deviceSchema);
