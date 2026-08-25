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
    // null = company-wide (HR's shared calendar, today's only mode). Set =
    // belongs to one client — excluded from the company-wide calendar and
    // reminded to that client's team instead of everyone. See
    // companyEvent.service.js#listForMonth/listForClient.
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = model('CompanyEvent', companyEventSchema);
