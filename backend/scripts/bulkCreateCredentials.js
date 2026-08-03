// One-off: generates a username + memorable password for every active
// employee who doesn't already have login credentials, creates the
// credential via the real Add Credentials service (bcrypt-hashed, no
// permissions granted), and writes the plaintext id/password pairs to a CSV
// for distribution — this is the only point the plaintext password is ever
// visible, same principle as a temporary onboarding password.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const Employee = require('../src/models/Employee');
const userRepository = require('../src/repositories/user.repository');
const userService = require('../src/services/user.service');

const SPECIALS = ['!', '@', '#', '$', '%', '*'];

function cleanLetters(s) {
  return (s || '').toLowerCase().replace(/[^a-z]/g, '');
}

function buildUsername(firstName, lastName, taken) {
  const base = cleanLetters(firstName) + (cleanLetters(lastName) ? '.' + cleanLetters(lastName) : '');
  const safeBase = base || 'employee';
  let candidate = safeBase;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${safeBase}${n}`;
    n++;
  }
  taken.add(candidate);
  return candidate;
}

// 8 chars, name-related: 6 letters from the name (padded if the name is
// short) + 1 digit + 1 special character.
function buildPassword(firstName, lastName) {
  const letters = (cleanLetters(firstName) + cleanLetters(lastName)).padEnd(6, 'x').slice(0, 6);
  const capped = letters.charAt(0).toUpperCase() + letters.slice(1);
  const digit = Math.floor(Math.random() * 10);
  const special = SPECIALS[Math.floor(Math.random() * SPECIALS.length)];
  return `${capped}${digit}${special}`;
}

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function main() {
  await mongoose.connect(env.mongodbUri);

  const employees = await Employee.find({ status: 'active', isDeleted: false }).sort({ firstName: 1 });
  const existingUsers = await userRepository.list();
  const linkedEmployeeIds = new Set(existingUsers.filter((u) => u.employeeLink).map((u) => String(u.employeeLink)));
  const takenUsernames = new Set(existingUsers.map((u) => u.username));

  const rows = [];
  let created = 0;
  let skipped = 0;

  for (const employee of employees) {
    if (linkedEmployeeIds.has(String(employee._id))) {
      skipped++;
      continue;
    }
    const username = buildUsername(employee.firstName, employee.lastName, takenUsernames);
    const password = buildPassword(employee.firstName, employee.lastName);

    await userService.createCredential(
      employee._id,
      { username, password, permissions: [] },
      { role: 'admin', permissions: [] }
    );
    created++;
    rows.push({
      employeeCode: employee.employeeCode || '',
      name: `${employee.firstName} ${employee.lastName || ''}`.trim(),
      username,
      password,
    });
  }

  const csvLines = ['Employee Code,Name,Employee ID,Password'];
  for (const r of rows) {
    csvLines.push([csvEscape(r.employeeCode), csvEscape(r.name), csvEscape(r.username), csvEscape(r.password)].join(','));
  }

  const outDir = 'C:\\Users\\ashan\\Desktop';
  const outPath = path.join(outDir, 'employee-credentials.csv');
  fs.writeFileSync(outPath, csvLines.join('\r\n'), 'utf8');

  console.log(`Active employees scanned: ${employees.length}`);
  console.log(`Already had credentials (skipped): ${skipped}`);
  console.log(`New credentials created: ${created}`);
  console.log(`CSV written to: ${outPath}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
