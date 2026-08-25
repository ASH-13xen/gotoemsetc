const FnfSettlement = require('../models/FnfSettlement');

const EMPLOYEE_FIELDS = 'firstName lastName employeeCode personalEmail';

function create(data) {
  return FnfSettlement.create(data);
}

function listAll() {
  return FnfSettlement.find({}).sort({ createdAt: -1 }).populate('employee', EMPLOYEE_FIELDS);
}

function findById(id) {
  return FnfSettlement.findById(id).populate('employee', EMPLOYEE_FIELDS);
}

function markPaid(id, { paidBy, transactionDetails }) {
  return FnfSettlement.findByIdAndUpdate(
    id,
    { status: 'paid', paidAt: new Date(), paidBy, transactionDetails },
    { new: true }
  ).populate('employee', EMPLOYEE_FIELDS);
}

module.exports = { create, listAll, findById, markPaid };
