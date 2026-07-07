const Employee = require('../models/Employee');

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

function count() {
  return Employee.countDocuments({ isDeleted: false });
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

module.exports = { list, findById, create, updateById, softDeleteById, count };
