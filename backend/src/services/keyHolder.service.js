const ApiError = require('../utils/ApiError');
const keyHolderRepository = require('../repositories/keyHolder.repository');
const employeeRepository = require('../repositories/employee.repository');
const { OFFICE_KEY } = require('../config/constants');

// Always returns all 5 keys, in the fixed OFFICE_KEY order — a key with no
// KeyHolder document yet (never assigned) comes back with `holder: null`
// rather than being omitted, so the frontend never has to special-case a
// missing row.
async function listKeys() {
  const docs = await keyHolderRepository.listAll();
  const byKey = new Map(docs.map((d) => [d.key, d]));

  return Object.values(OFFICE_KEY).map((key) => {
    const doc = byKey.get(key);
    return {
      key,
      holder: doc?.holder ?? null,
      updatedBy: doc?.updatedBy ?? null,
      updatedAt: doc?.updatedAt ?? null,
    };
  });
}

// employeeId may be null/undefined to clear the key back to unassigned.
async function assignKey(key, employeeId, updatedByUserId) {
  if (!Object.values(OFFICE_KEY).includes(key)) {
    throw ApiError.badRequest('Invalid key');
  }
  if (employeeId) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee) throw ApiError.notFound('Employee not found');
  }
  return keyHolderRepository.setHolder(key, employeeId || null, updatedByUserId);
}

module.exports = { listKeys, assignKey };
