const { Schema, model } = require('mongoose');
const { CLIENT_STATUS } = require('../config/constants');

const contactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const clientSchema = new Schema(
  {
    clientName: { type: String, required: true, trim: true },
    brandName: { type: String, required: true, trim: true },
    dateRegistered: { type: Date, required: true },
    logoUrl: { type: String },
    contacts: [contactSchema],
    status: {
      type: String,
      enum: Object.values(CLIENT_STATUS),
      default: CLIENT_STATUS.LEAD,
    },
    currentQuotation: { type: Schema.Types.ObjectId, ref: 'Quotation' },
    // Stamped the moment a quotation is client-signed (see quotation.service.js
    // clientSign) — the anchor date recurring task cycles are measured from,
    // distinct from dateRegistered (which is just when the lead was entered).
    onboardedAt: { type: Date },
    // Set from the Followups section — surfaces the assigned team's leader
    // wherever this client is displayed. Optional and ignored by frontendsales.
    assignedTeam: { type: Schema.Types.ObjectId, ref: 'Team' },
    // Direct employee-level assignment, separate from (and independent of)
    // assignedTeam — one or more employees handling this client, with a
    // single one of them marked as the point of accountability.
    assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    mainEmployee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

clientSchema.index({ clientName: 'text', brandName: 'text' });

module.exports = model('Client', clientSchema);
