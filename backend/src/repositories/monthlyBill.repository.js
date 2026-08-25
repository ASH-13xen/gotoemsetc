const MonthlyBill = require('../models/MonthlyBill');

function create(data) {
  return MonthlyBill.create(data);
}

function listAll() {
  return MonthlyBill.find({}).sort({ createdAt: -1 });
}

function findById(id) {
  return MonthlyBill.findById(id);
}

// Every bill still spawning future instances — the monthly cycle job's
// worklist. See jobs/monthlyBillCycle.job.js#spawnMonthlyInstances.
function listActive() {
  return MonthlyBill.find({ isActive: true });
}

function setActive(id, isActive) {
  return MonthlyBill.findByIdAndUpdate(id, { isActive }, { new: true });
}

function addInstance(id, instance) {
  return MonthlyBill.findByIdAndUpdate(id, { $push: { instances: instance } }, { new: true });
}

// Positional update against the matching embedded instance — same pattern
// as taskClient.repository.js#recordTeamChange's teamHistory.$.endedAt.
async function markInstancePaid(billId, instanceId, { status, paidBy, transactionDetails }) {
  await MonthlyBill.updateOne(
    { _id: billId, 'instances._id': instanceId },
    {
      $set: {
        'instances.$.status': status,
        'instances.$.paidAt': new Date(),
        'instances.$.paidBy': paidBy,
        'instances.$.transactionDetails': transactionDetails,
      },
    }
  );
  return MonthlyBill.findById(billId);
}

module.exports = { create, listAll, findById, listActive, setActive, addInstance, markInstancePaid };
