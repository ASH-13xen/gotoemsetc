require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const User = require('../src/models/User');
const { USER_ROLES } = require('../src/config/constants');

const users = [
  { username: 'admin', password: 'admin', role: USER_ROLES.ADMIN },
  { username: 'worker1', password: 'worker1', role: USER_ROLES.WORKER },
  { username: 'worker2', password: 'worker2', role: USER_ROLES.WORKER },
  { username: 'worker3', password: 'worker3', role: USER_ROLES.WORKER },
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
