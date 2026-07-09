const Applicant = require('../models/Applicant');

function listQuery({ search, status }) {
  const query = { isDeleted: false };
  if (status) query.status = status;
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { positionAppliedFor: regex },
    ];
  }
  return query;
}

async function list({ search, status, page = 1, limit = 20 }) {
  const query = listQuery({ search, status });
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Applicant.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Applicant.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

function findById(id) {
  return Applicant.findOne({ _id: id, isDeleted: false });
}

function findByGoogleFormResponseId(googleFormResponseId) {
  return Applicant.findOne({ googleFormResponseId });
}

function create(data) {
  return Applicant.create(data);
}

function updateById(id, data) {
  return Applicant.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  });
}

function softDeleteById(id) {
  return Applicant.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { returnDocument: 'after' }
  );
}

module.exports = {
  list,
  findById,
  findByGoogleFormResponseId,
  create,
  updateById,
  softDeleteById,
};
