// Sets a new password for an existing credential.
//
//   node scripts/resetUserPassword.js <username> <newPassword>
//
// Passwords are bcrypt-hashed one way (see auth.service.js), so a forgotten
// one can never be read back — resetting is the only recovery path. The new
// password is taken as an argument rather than hardcoded, so nothing secret
// ends up committed; note it does land in your shell history, so treat it as
// temporary and have the user change it.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const User = require('../src/models/User');

async function main() {
  const [username, newPassword] = process.argv.slice(2);

  if (!username || !newPassword) {
    throw new Error('Usage: node scripts/resetUserPassword.js <username> <newPassword>');
  }
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  await mongoose.connect(env.mongodbUri);

  // Deliberately not filtered on isActive — resetting the password of a
  // disabled credential is a legitimate step in re-enabling it.
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) throw new Error(`No user named "${username}"`);

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  console.log(`Password reset for ${user.username} (role ${user.role})`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
