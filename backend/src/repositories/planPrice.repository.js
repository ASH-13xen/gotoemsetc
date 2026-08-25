const PlanPrice = require('../models/PlanPrice');
const { CMS_PLAN } = require('../config/constants');

// Ensures a row exists for every plan tier (amount 0 if never set), then
// returns all of them — lazy-seed-on-read instead of a migration script.
async function listAllEnsured() {
  for (const plan of Object.values(CMS_PLAN)) {
    // eslint-disable-next-line no-await-in-loop
    await PlanPrice.updateOne({ plan }, { $setOnInsert: { plan, amount: 0 } }, { upsert: true });
  }
  return PlanPrice.find({}).sort({ plan: 1 });
}

function findByPlan(plan) {
  return PlanPrice.findOne({ plan });
}

function setAmount(plan, amount) {
  return PlanPrice.findOneAndUpdate({ plan }, { amount }, { upsert: true, new: true });
}

module.exports = { listAllEnsured, findByPlan, setAmount };
