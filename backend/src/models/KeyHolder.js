const { Schema, model } = require('mongoose');
const { OFFICE_KEY } = require('../config/constants');

// One document per physical key (see OFFICE_KEY) — created on first
// assignment, not pre-seeded; keyHolder.service.js#listKeys fills in the
// other, never-yet-assigned keys as `holders: []` so the API always returns
// all 5 regardless of which ones have a document yet.
//
// `holders` is an array — several physical copies of the same key can be
// out with different employees at once (e.g. 3 copies of the main gate key
// held by 3 people), so this is a many-holders-per-key relationship, not
// single-holder. Was a singular `holder: ObjectId` field until this session;
// see scripts/_tmp_migrateKeyHolderToArray.js for the one-time data migration.
const keyHolderSchema = new Schema(
  {
    key: { type: String, enum: Object.values(OFFICE_KEY), required: true, unique: true },
    holders: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = model('KeyHolder', keyHolderSchema);
