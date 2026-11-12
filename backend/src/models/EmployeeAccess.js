const { Schema, model } = require('mongoose');
const { ACCESS_DEVICE_TYPES, ACCESS_ITEM_KINDS } = require('../utils/deviceCatalog');

// One person's access checklist — built from the access matrix for their
// designation (DeviceSettings.accessTemplates), plus anything added for them
// alone. Each item is ticked once it is set up; revoking someone
// (deviceAccess.service.js#startRevoke) turns every done item into a step.
const employeeAccessSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
    items: [
      {
        key: { type: String, required: true },
        deviceType: { type: String, enum: Object.keys(ACCESS_DEVICE_TYPES), required: true },
        kind: { type: String, enum: Object.keys(ACCESS_ITEM_KINDS), default: 'app' },
        label: { type: String, required: true, trim: true },
        detail: { type: String, trim: true },
        fromTemplate: { type: Boolean, default: true },
        status: { type: String, enum: ['pending', 'done', 'na', 'revoked'], default: 'pending' },
        doneAt: Date,
        doneBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = model('EmployeeAccess', employeeAccessSchema);
