const ApiError = require('../utils/ApiError');
const companyEventRepository = require('../repositories/companyEvent.repository');
const { COMPANY_EVENT_TYPE } = require('../config/constants');

// client_birthday/client_anniversary/brand_anniversary recur yearly —
// month/day only, same reasoning as employee birthdays (see
// employee.service.js#listBirthdays), so one entered in 1990 still shows up
// every June going forward. `important` is a one-off marker for a specific
// date and must NOT recur, so it additionally requires the year to match.
// Unpaginated: total volume here (client roster + a handful of important
// markers) never approaches a scale where filtering in JS instead of the DB
// matters.
async function listForMonth(month, year) {
  const all = await companyEventRepository.list();
  if (!month) return all;
  return all.filter((e) => {
    const d = new Date(e.date);
    if (d.getUTCMonth() + 1 !== month) return false;
    if (e.type === COMPANY_EVENT_TYPE.IMPORTANT) {
      return !year || d.getUTCFullYear() === year;
    }
    return true;
  });
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
