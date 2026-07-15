const { Schema, model } = require('mongoose');

// Raw log of every scan the biometric device pushes — stored as-is, even
// when the device's PIN doesn't match any employeeCode, so mismatches are
// visible/debuggable instead of silently dropped.
const devicePunchSchema = new Schema(
  {
    employeeCode: { type: String, required: true, trim: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    timestamp: { type: Date, required: true, index: true },
    deviceSerial: { type: String, trim: true },
    raw: { type: String },
  },
  { timestamps: true }
);

module.exports = model('DevicePunch', devicePunchSchema);
