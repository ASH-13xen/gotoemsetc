const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/user.repository');

async function listUsers() {
  return userRepository.list();
}

async function getUser(id) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

module.exports = { listUsers, getUser };
