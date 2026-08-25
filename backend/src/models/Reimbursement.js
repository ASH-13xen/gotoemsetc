const { Schema, model } = require('mongoose');
const { REIMBURSEMENT_CATEGORY, REIMBURSEMENT_TRAVEL_MODE, REIMBURSEMENT_STATUS } = require('../config/constants');

const transactionDetailsSchema = new Schema(
  { mode: String, referenceNumber: String, paidOn: Date, note: String },
  { _id: false }
);

const receiptFileSchema = new Schema(
  { data: Buffer, contentType: String, filename: String },
  { _id: false }
);

const reimbursementSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    category: { type: String, enum: Object.values(REIMBURSEMENT_CATEGORY), required: true },
    // Only meaningful when category === 'travel'.
    travelMode: { type: String, enum: Object.values(REIMBURSEMENT_TRAVEL_MODE) },
    // Only meaningful when category === 'client_work' — client links to the
    // registry when the brand is already a client; clientBrandName is a
    // free-text fallback otherwise (both optional, either may be set).
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient' },
    clientBrandName: { type: String, trim: true },

    // The claim-window-gated date (see reimbursement.service.js) — separate
    // from startAt/endAt, which are the work's own start/end date+time.
    expenseDate: { type: Date, required: true },
    startAt: Date,
    endAt: Date,

    description: { type: String, required: true, trim: true },
    peopleInvolved: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    amount: { type: Number, required: true, min: 0 },

    // Excluded by default from list reads — same in-Mongo storage and
    // exclusion convention as GeneratedDocument's pdf/docx bytes.
    receiptFile: receiptFileSchema,

    status: { type: String, enum: Object.values(REIMBURSEMENT_STATUS), default: REIMBURSEMENT_STATUS.PENDING },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,

    paidAt: Date,
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    transactionDetails: transactionDetailsSchema,
  },
  { timestamps: true }
);

reimbursementSchema.index({ employee: 1, createdAt: -1 });
reimbursementSchema.index({ status: 1 });

module.exports = model('Reimbursement', reimbursementSchema);
