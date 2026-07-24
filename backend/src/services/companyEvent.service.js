const ApiError = require('../utils/ApiError');
const companyEventRepository = require('../repositories/companyEvent.repository');

// Recurring yearly, month/day only — same reasoning as employee birthdays
// (see employee.service.js#listBirthdays), so a client birthday entered in
// 1990 still shows up every June going forward. Unpaginated: total volume
// here (client roster + one brand anniversary) never approaches a scale
// where filtering in JS instead of the DB matters.
async function listForMonth(month) {
  const all = await companyEventRepository.list();
  if (!month) return all;
  return all.filter((e) => new Date(e.date).getUTCMonth() + 1 === month);
}

async function createEvent({ type, name, date, notes }, createdBy) {
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) throw ApiError.badRequest('Invalid date');
  return companyEventRepository.create({ type, name, date: normalized, notes, createdBy });
}

async function removeEvent(id) {
  const event = await companyEventRepository.removeById(id);
  if (!event) throw ApiError.notFound('Company event not found');
  return event;
}

module.exports = { listForMonth, createEvent, removeEvent };
