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

module.exports = { create, listByEmployee, findById };
