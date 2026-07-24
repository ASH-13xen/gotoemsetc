const { Schema, model } = require('mongoose');
const { COMPANY_EVENT_TYPE } = require('../config/constants');

// Manually-entered recurring events — client birthdays/anniversaries and the
// brand anniversary. Recurs yearly off month/day only (see
// companyEvent.service.js#listForMonth), same convention as Employee.dob —
// the stored year is whatever the entry happened to use, never compared.
const companyEventSchema = new Schema(
  {
    type: { type: String, enum: Object.values(COMPANY_EVENT_TYPE), required: true },
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = model('CompanyEvent', companyEventSchema);
