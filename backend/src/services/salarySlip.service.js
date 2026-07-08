const path = require('node:path');
const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const salarySlipRepository = require('../repositories/salarySlip.repository');
const localFileStorage = require('../services/localFileStorage.service');
const salaryCalculation = require('./salaryCalculation.service');
const salarySlipStamp = require('./salarySlipStamp.service');

const NAMESPACE = 'salary-slips';

async function generateSlip(employeeId, input, createdBy) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const { month, year, cutoffDate: cutoffDateStr, ...manualInputs } = input;

  const cutoffDate = new Date(cutoffDateStr);
  if (Number.isNaN(cutoffDate.getTime())) throw ApiError.badRequest('Invalid cutoff date');
  if (cutoffDate.getTime() > Date.now()) {
    throw ApiError.badRequest('Cutoff date cannot be in the future');
  }
  if (cutoffDate.getUTCFullYear() !== year || cutoffDate.getUTCMonth() + 1 !== month) {
    throw ApiError.badRequest('Cutoff date must fall within the selected month/year');
  }

  const summary = await salaryCalculation.computeAttendanceSummary(employeeId, year, month, cutoffDate);
  const salary = salaryCalculation.computeSalary(employee, summary, manualInputs);

  const pdfBuffer = await salarySlipStamp.generateSalarySlipPdf({ employee, month, year, cutoffDate, summary, salary });

  const relativePath = path.join(String(employeeId), `${year}-${String(month).padStart(2, '0')}-${Date.now()}.pdf`);
  const filePath = await localFileStorage.saveBuffer(pdfBuffer, relativePath, NAMESPACE);

  return salarySlipRepository.create({
    employee: employeeId,
    month,
    year,
    cutoffDate,
    ...manualInputs,
    basicMaster: salary.basicMaster,
    basicEarnings: salary.basicEarnings,
    otMaster: salary.otMaster,
    otEarnings: salary.otEarnings,
    halfDayDeductions: salary.halfDayDeductions,
    unpaidOffDeductions: salary.unpaidOffDeductions,
    grossEarnings: salary.grossEarnings,
    totalDeductions: salary.totalDeductions,
    totalReimbursements: salary.totalReimbursements,
    netPayable: salary.netPayable,
    generatedFile: { filePath },
    createdBy,
  });
}

async function listForEmployee(employeeId) {
  return salarySlipRepository.listByEmployee(employeeId);
}

async function getFilePath(id) {
  const slip = await salarySlipRepository.findById(id);
  if (!slip) throw ApiError.notFound('Salary slip not found');
  return { filePath: slip.generatedFile.filePath, namespace: NAMESPACE };
}

module.exports = { generateSlip, listForEmployee, getFilePath };
