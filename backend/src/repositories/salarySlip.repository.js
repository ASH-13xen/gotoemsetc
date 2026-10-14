const SalarySlip = require('../models/SalarySlip');

function create(data) {
  return SalarySlip.create(data);
}

function listByEmployee(employeeId) {
  return SalarySlip.find({ employee: employeeId }).sort({ year: -1, month: -1, createdAt: -1 });
}

function findById(id) {
  return SalarySlip.findById(id);
}

// Every slip whose startDate falls anywhere in [year, month] — the finance
// service buckets these by IST month and keeps only the latest per employee.
// Wide net on purpose (a slip's startDate/endDate isn't anchored to a single
// calendar month), narrowed in the service layer via istDate.js.
function listByStartDateMonth(monthStart, monthEnd) {
  return SalarySlip.find({ startDate: { $gte: monthStart, $lt: monthEnd } })
    .populate('employee', 'firstName lastName employeeCode personalEmail')
    .sort({ createdAt: -1 });
}

function markPaid(id, { paidBy, transactionDetails, paymentReceiptFile }) {
  return SalarySlip.findByIdAndUpdate(
    id,
    { paymentStatus: 'paid', paidAt: new Date(), paidBy, transactionDetails, paymentReceiptFile, paidSeenByEmployee: false },
    { new: true }
  ).populate('employee', 'firstName lastName employeeCode personalEmail');
}

// Paid slips the employee hasn't closed the notice for yet.
function listPaidUnseen(employeeId) {
  return SalarySlip.find({ employee: employeeId, paymentStatus: 'paid', paidSeenByEmployee: false, 'paymentReceiptFile.filename': { $exists: true } }).sort({ paidAt: -1 });
}

function markPaidSeen(id) {
  return SalarySlip.findByIdAndUpdate(id, { paidSeenByEmployee: true }, { new: true });
}

function findByIdWithReceipt(id) {
  return SalarySlip.findById(id).select('+paymentReceiptFile.data');
}

module.exports = { create, listByEmployee, findById, listByStartDateMonth, markPaid, listPaidUnseen, markPaidSeen, findByIdWithReceipt };
