require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const User = require('../src/models/User');
const { USER_ROLES } = require('../src/config/constants');

// Passwords are never hardcoded here — they come from .env (gitignored) or
// the deploy host's env var dashboard, so they never end up committed to git.
function requiredPassword(envVar) {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
  return value;
}

const users = [
  { username: 'admin', password: requiredPassword('SEED_ADMIN_PASSWORD'), role: USER_ROLES.ADMIN },
  { username: 'hr', password: requiredPassword('SEED_HR_PASSWORD'), role: USER_ROLES.HR },
  { username: 'worker1', password: requiredPassword('SEED_WORKER1_PASSWORD'), role: USER_ROLES.WORKER },
  { username: 'worker2', password: requiredPassword('SEED_WORKER2_PASSWORD'), role: USER_ROLES.WORKER },
  { username: 'worker3', password: requiredPassword('SEED_WORKER3_PASSWORD'), role: USER_ROLES.WORKER },
];

async function main() {
  await mongoose.connect(env.mongodbUri);

  for (const { username, password, role } of users) {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate(
      { username },
      { $set: { passwordHash, role, isActive: true } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    console.log(`Seeded user: ${username} (${role})`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
