// Restores a Task Management backup produced by wipeTaskManagement.js.
// Usage: node scripts/restoreTaskManagementBackup.js "<path to backup json>"
// Re-inserts by _id (insertMany), so this only works cleanly against an
// empty/still-wiped Task Management dataset — it does not merge with data
// created after the wipe.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const EmployeeTask = require('../src/models/EmployeeTask');
const WorkTeam = require('../src/models/WorkTeam');
const TaskClient = require('../src/models/TaskClient');
const TaskEvent = require('../src/models/TaskEvent');
const Notification = require('../src/models/Notification');

async function restoreCollection(Model, docs, label) {
  if (!docs || docs.length === 0) {
    console.log(`${label}: nothing to restore`);
    return;
  }
  await Model.insertMany(docs, { ordered: false });
  console.log(`${label}: restored ${docs.length}`);
}

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error('Usage: node scripts/restoreTaskManagementBackup.js "<path to backup json>"');
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  await mongoose.connect(env.mongodbUri);

  await restoreCollection(WorkTeam, backup.workTeams, 'WorkTeam');
  await restoreCollection(TaskClient, backup.taskClients, 'TaskClient');
  await restoreCollection(TaskEvent, backup.taskEvents, 'TaskEvent');
  await restoreCollection(EmployeeTask, backup.employeeTasks, 'EmployeeTask');
  await restoreCollection(Notification, backup.notifications, 'Notification (task-related)');

  console.log('Restore complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
