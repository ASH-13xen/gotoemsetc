const { Schema, model } = require('mongoose');

// A shoot's footage, uploaded from a company phone straight to the company
// Google Drive — logged with its Drive link, so nobody has to plug a phone
// into a laptop, and nothing is cleared from a phone before it is safely up.
const footageUploadSchema = new Schema(
  {
    device: { type: Schema.Types.ObjectId, ref: 'Device', default: null },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    loggedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    shootDate: { type: Date, required: true },
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

footageUploadSchema.index({ shootDate: -1 });

module.exports = model('FootageUpload', footageUploadSchema);
