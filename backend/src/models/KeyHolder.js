const { Schema, model } = require('mongoose');
const { OFFICE_KEY } = require('../config/constants');

// One document per physical key (see OFFICE_KEY) — created on first
// assignment, not pre-seeded; keyHolder.service.js#listKeys fills in the
// other, never-yet-assigned keys as `holder: null` so the API always returns
// all 5 regardless of which ones have a document yet.
const keyHolderSchema = new Schema(
  {
    key: { type: String, enum: Object.values(OFFICE_KEY), required: true, unique: true },
    holder: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = model('KeyHolder', keyHolderSchema);
