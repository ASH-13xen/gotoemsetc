const { Schema, model } = require('mongoose');
const { ASSIGNMENT_STATUS } = require('../utils/deviceCatalog');

// One spell of a device with one person: handed over (with its accessories,
// a handover check and the agreement), then returned (with a return check and
// a receipt) or lost. The device's full history is these, newest first.
const deviceAssignmentSchema = new Schema(
  {
    device: { type: Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    status: { type: String, enum: Object.values(ASSIGNMENT_STATUS), default: ASSIGNMENT_STATUS.ACTIVE, index: true },

    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // The holder confirmed on their dashboard that they have it, as described.
    acceptedAt: Date,

    accessories: [
      {
        _id: false,
        accessory: { type: Schema.Types.ObjectId, ref: 'DeviceAccessory' },
        label: String,
        qty: { type: Number, default: 1 },
        returnedQty: { type: Number, default: 0 },
      },
    ],
    handoverCheck: { type: Schema.Types.ObjectId, ref: 'DeviceCheck' },
    returnCheck: { type: Schema.Types.ObjectId, ref: 'DeviceCheck' },

    // Things to do when it changes hands (e.g. add / remove the holder's
    // company mail) — ticked by HR.
    setupSteps: [{ key: String, label: String, doneAt: Date, doneBy: { type: Schema.Types.ObjectId, ref: 'User' } }],

    // The signed handover agreement (generated from the data here, signed,
    // and the signed copy uploaded).
    signedAgreement: { type: Schema.Types.ObjectId, ref: 'DeviceFile', default: null },
    signedAgreementAt: Date,
    signedReceipt: { type: Schema.Types.ObjectId, ref: 'DeviceFile', default: null },

    returnedAt: Date,
    returnedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    returnNote: { type: String, trim: true },

    lostAt: Date,
    lostNote: { type: String, trim: true },
    // What is owed for a lost device (and missing accessories), and how it was settled.
    recoveryAmount: Number,
    recoverySettledIn: { type: Schema.Types.ObjectId, ref: 'FnfSettlement', default: null },
    recoveryWaivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    recoveryWaivedAt: Date,
    recoveryNote: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = model('DeviceAssignment', deviceAssignmentSchema);
