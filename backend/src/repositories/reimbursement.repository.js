const Reimbursement = require('../models/Reimbursement');

const EMPLOYEE_FIELDS = 'firstName lastName employeeCode personalEmail';
// receiptFile.data excluded by default — same convention as
// GeneratedDocument's WITHOUT_FILE_DATA, only loaded for the actual download.
const WITHOUT_FILE_DATA = '-receiptFile.data';

const POPULATE = [
  { path: 'employee', select: EMPLOYEE_FIELDS },
  { path: 'client', select: 'name brandName' },
  { path: 'peopleInvolved', select: EMPLOYEE_FIELDS },
  { path: 'approvedBy', select: 'username role' },
  { path: 'paidBy', select: 'username role' },
];

function create(data) {
  return Reimbursement.create(data);
}

function findById(id) {
  return Reimbursement.findById(id).select(WITHOUT_FILE_DATA).populate(POPULATE);
}

function findByIdWithFile(id) {
  return Reimbursement.findById(id);
}

function listByEmployee(employeeId) {
  return Reimbursement.find({ employee: employeeId }).select(WITHOUT_FILE_DATA).sort({ createdAt: -1 }).populate(POPULATE);
}

function listAll({ status } = {}) {
  const query = {};
  if (status) query.status = status;
  return Reimbursement.find(query).select(WITHOUT_FILE_DATA).sort({ createdAt: -1 }).populate(POPULATE);
}

function updateById(id, data) {
  return Reimbursement.findByIdAndUpdate(id, data, { new: true }).select(WITHOUT_FILE_DATA).populate(POPULATE);
}

function setReceiptFile(id, receiptFile) {
  return Reimbursement.findByIdAndUpdate(id, { receiptFile }, { new: true }).select(WITHOUT_FILE_DATA).populate(POPULATE);
}

// The Saturday payment-reminder job's worklist — approved and not yet paid.
function listApprovedUnpaid() {
  return Reimbursement.find({ status: 'approved' }).select(WITHOUT_FILE_DATA);
}

module.exports = {
  create,
  findById,
  findByIdWithFile,
  listByEmployee,
  listAll,
  updateById,
  setReceiptFile,
  listApprovedUnpaid,
};
