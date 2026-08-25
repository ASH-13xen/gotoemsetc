const { Schema, model } = require('mongoose');
const { CMS_PLAN } = require('../config/constants');

// One flat price per plan tier — every client on a tier is billed the same
// amount (your call over per-client custom pricing). Rows are lazily
// upserted with amount 0 the first time they're read (see
// planPrice.repository.js#listAllEnsured) rather than seeded by a script.
const planPriceSchema = new Schema(
  {
    plan: { type: String, enum: Object.values(CMS_PLAN), required: true, unique: true },
    amount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

module.exports = model('PlanPrice', planPriceSchema);
