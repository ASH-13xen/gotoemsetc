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
    contacts: [contactSchema],
    status: {
      type: String,
      enum: Object.values(CLIENT_STATUS),
      default: CLIENT_STATUS.LEAD,
    },
    currentQuotation: { type: Schema.Types.ObjectId, ref: 'Quotation' },
    // Set from the Followups section — surfaces the assigned team's leader
    // wherever this client is displayed. Optional and ignored by frontendsales.
    assignedTeam: { type: Schema.Types.ObjectId, ref: 'Team' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

clientSchema.index({ clientName: 'text', brandName: 'text' });

module.exports = model('Client', clientSchema);
