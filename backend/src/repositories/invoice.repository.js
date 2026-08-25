const Invoice = require('../models/Invoice');

const POPULATE = { path: 'client', select: 'name brandName contacts currentPlan' };

function create(data) {
  return Invoice.create(data);
}

function findById(id) {
  return Invoice.findById(id).populate(POPULATE);
}

function findByClientAndMonth(clientId, year, month) {
  return Invoice.findOne({ client: clientId, year, month });
}

function list({ status, year, month, clientId, plan } = {}) {
  const query = {};
  if (status) query.status = status;
  if (year) query.year = Number(year);
  if (month) query.month = Number(month);
  if (clientId) query.client = clientId;
  if (plan) query.plan = plan;
  return Invoice.find(query).sort({ year: -1, month: -1, createdAt: -1 }).populate(POPULATE);
}

function updateById(id, data) {
  return Invoice.findByIdAndUpdate(id, data, { new: true }).populate(POPULATE);
}

// Highest invoiceNumber already issued this financial year, for the
// sequential counter — see invoice.service.js#nextInvoiceNumber.
function countForFyPrefix(prefix) {
  return Invoice.countDocuments({ invoiceNumber: { $regex: `^INV/${prefix}/` } });
}

// Reporting — every invoice matching the filter, minimal fields, for
// summing/grouping in the service layer rather than a Mongo aggregation
// pipeline (dataset is small: a handful of clients x 12 months).
function listForSummary({ year, month, clientId, plan } = {}) {
  const query = {};
  if (year) query.year = Number(year);
  if (month) query.month = Number(month);
  if (clientId) query.client = clientId;
  if (plan) query.plan = plan;
  return Invoice.find(query).select('client year month plan amount status').populate('client', 'name');
}

module.exports = {
  create,
  findById,
  findByClientAndMonth,
  list,
  updateById,
  countForFyPrefix,
  listForSummary,
};
