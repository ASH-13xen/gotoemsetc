const Employee = require('../models/Employee');
const { EMPLOYEE_STATUS } = require('../config/constants');

function listQuery({ search, status }) {
  const query = { isDeleted: false };
  if (status) query.status = status;
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { personalEmail: regex },
      { employeeCode: regex },
      { designation: regex },
    ];
  }
  return query;
}

async function list({ search, status, page = 1, limit = 20 }) {
  const query = listQuery({ search, status });
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Employee.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Employee.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

function findById(id) {
  return Employee.findOne({ _id: id, isDeleted: false });
}

// Maps a biometric device's numeric user ID (PIN) to an employee. Most
// ZKTeco terminals only accept digits for the enrollment ID, but real
// employeeCode values here look like "EMS-0012" — so if there's no exact
// match, fall back to comparing digits-only (leading zeros ignored), which
// lets you enroll someone with code "EMS-0012" using PIN "12" on the device.
async function findByCode(employeeCode) {
  const exact = await Employee.findOne({ employeeCode, isDeleted: false });
  if (exact) return exact;

  const digits = String(employeeCode).replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;

  const candidates = await Employee.find({ isDeleted: false, employeeCode: { $regex: /\d/ } }).select(
    'employeeCode'
  );
  const match = candidates.find((e) => e.employeeCode.replace(/\D/g, '').replace(/^0+/, '') === digits);
  return match ? Employee.findOne({ _id: match._id, isDeleted: false }) : null;
}

function findByIds(ids) {
  return Employee.find({ _id: { $in: ids }, isDeleted: false });
}

function count() {
  return Employee.countDocuments({ isDeleted: false });
}

function countByStatus(status) {
  return Employee.countDocuments({ isDeleted: false, status });
}

// Unpaginated — used by the birthday reminder cron job, which needs to scan
// every active employee with a recorded date of birth once a day. Excludes
// offboarded (and draft) employees on purpose — no birthday pings for
// someone who no longer works here.
function listAllWithDob() {
  return Employee.find({ isDeleted: false, status: EMPLOYEE_STATUS.ACTIVE, dob: { $ne: null } });
}

function create(data) {
  return Employee.create(data);
}

function updateById(id, data) {
  return Employee.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  });
}

function softDeleteById(id) {
  return Employee.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { returnDocument: 'after' }
  );
}

module.exports = {
  list,
  findById,
  findByIds,
  findByCode,
  create,
  updateById,
  softDeleteById,
  count,
  countByStatus,
  listAllWithDob,
};
