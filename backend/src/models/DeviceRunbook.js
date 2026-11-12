const { Schema, model } = require('mongoose');

// A list of things to do, ticked one by one with who and when:
//  - 'lost': a device lost or not returned — lock, block the SIM, change the
//    passwords of every account on it, police complaint, recovery;
//  - 'revoke': someone cut off from everything — their EMS login (done the
//    moment it starts), then every account and group they had access to.
// It stays open (and in the Action centre) until every step is done.
const runbookStepSchema = new Schema({
  key: String,
  label: { type: String, required: true },
  detail: String,
  account: { type: Schema.Types.ObjectId, ref: 'DeviceAccount', default: null },
  done: { type: Boolean, default: false },
  doneAt: Date,
  doneBy: { type: Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, trim: true },
  file: { type: Schema.Types.ObjectId, ref: 'DeviceFile', default: null }, // e.g. the police complaint
});

const deviceRunbookSchema = new Schema(
  {
    kind: { type: String, enum: ['lost', 'revoke'], required: true },
    device: { type: Schema.Types.ObjectId, ref: 'Device', default: null },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    reason: { type: String, trim: true },
    startedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    steps: [runbookStepSchema],
    closedAt: Date,
  },
  { timestamps: true }
);

module.exports = model('DeviceRunbook', deviceRunbookSchema);
