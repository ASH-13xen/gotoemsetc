const ApiError = require('../utils/ApiError');
const keyHolderRepository = require('../repositories/keyHolder.repository');
const employeeRepository = require('../repositories/employee.repository');
const { OFFICE_KEY } = require('../config/constants');

// Always returns all 5 keys, in the fixed OFFICE_KEY order — a key with no
// KeyHolder document yet (never assigned) comes back with `holders: []`
// rather than being omitted, so the frontend never has to special-case a
// missing row.
async function listKeys() {
  const docs = await keyHolderRepository.listAll();
  const byKey = new Map(docs.map((d) => [d.key, d]));

  return Object.values(OFFICE_KEY).map((key) => {
    const doc = byKey.get(key);
    return {
      key,
      holders: doc?.holders ?? [],
      updatedBy: doc?.updatedBy ?? null,
      updatedAt: doc?.updatedAt ?? null,
    };
  });
}

// employeeIds replaces the full holder list for this key — several physical
// copies of one key can be out with different people at once, so this isn't
// a single assignment. An empty array clears the key back to unassigned.
async function assignKeyHolders(key, employeeIds, updatedByUserId) {
  if (!Object.values(OFFICE_KEY).includes(key)) {
    throw ApiError.badRequest('Invalid key');
  }
  const uniqueIds = [...new Set(employeeIds || [])];
  if (uniqueIds.length > 0) {
    const employees = await Promise.all(uniqueIds.map((id) => employeeRepository.findById(id)));
    const missingIndex = employees.findIndex((e) => !e);
    if (missingIndex !== -1) throw ApiError.notFound('Employee not found');
  }
  return keyHolderRepository.setHolders(key, uniqueIds, updatedByUserId);
}

module.exports = { listKeys, assignKeyHolders };
