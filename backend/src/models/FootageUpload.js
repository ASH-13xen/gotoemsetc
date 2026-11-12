const { Schema, model } = require('mongoose');

// A shoot's footage, uploaded from a company phone straight to the company
// Google Drive — logged with its Drive link, so nobody has to plug a phone
// into a laptop, and nothing is cleared from a phone before it is safely up.
const footageUploadSchema = new Schema(
  {
    device: { type: Schema.Types.ObjectId, ref: 'Device', default: null },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    loggedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // When it was logged is createdAt (always); the shoot's own date is optional.
    shootDate: { type: Date, default: null },
    // The company Google account (Accounts register) whose Drive it went to.
    driveAccount: { type: Schema.Types.ObjectId, ref: 'DeviceAccount', default: null },
    driveName: { type: String, trim: true },
    // Who uploaded it — the person logging by default, any colleague otherwise.
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    // HR opened the link and checked the footage is there.
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', default: null },
    clientName: { type: String, trim: true },
    driveLink: { type: String, required: true, trim: true },
    files: Number,
    sizeGb: Number,
    clearedFromPhone: { type: Boolean, default: false },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

footageUploadSchema.index({ createdAt: -1 });
footageUploadSchema.index({ verifiedAt: 1 });

module.exports = model('FootageUpload', footageUploadSchema);
