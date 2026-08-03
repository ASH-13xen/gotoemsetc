// One-off: backs up every Task Management document (EmployeeTask, WorkTeam,
// TaskClient, TaskEvent, and their Notification entries) to a JSON file
// outside the repo, then deletes them from the live database. Does NOT
// touch anything else — not EMS, not the unrelated legacy CMS Task/Team/
// Event system (see constants.js's NOTIFICATION_TYPES comment distinguishing
// the two), not User accounts/permissions.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const EmployeeTask = require('../src/models/EmployeeTask');
const WorkTeam = require('../src/models/WorkTeam');
const TaskClient = require('../src/models/TaskClient');
const TaskEvent = require('../src/models/TaskEvent');
const Notification = require('../src/models/Notification');

const TASK_NOTIFICATION_TYPES = [
  'employee_task_assigned',
  'employee_task_for_review',
  'employee_task_completed',
  'employee_task_followup_reminder',
  'employee_task_rejected',
];

async function main() {
  await mongoose.connect(env.mongodbUri);

  const [employeeTasks, workTeams, taskClients, taskEvents, notifications] = await Promise.all([
    EmployeeTask.find({}).lean(),
    WorkTeam.find({}).lean(),
    TaskClient.find({}).lean(),
    TaskEvent.find({}).lean(),
    Notification.find({ type: { $in: TASK_NOTIFICATION_TYPES } }).lean(),
  ]);

  const backup = {
    createdAt: new Date().toISOString(),
    note: 'Temporary Task Management restore point — safe to delete after the expiry noted in the accompanying README.',
    employeeTasks,
    workTeams,
    taskClients,
    taskEvents,
    notifications,
  };

  const backupDir = 'C:\\Users\\ashan\\Desktop\\EMS-backups';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `task-management-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

  console.log('Backed up:');
  console.log('  EmployeeTask:', employeeTasks.length);
  console.log('  WorkTeam:', workTeams.length);
  console.log('  TaskClient:', taskClients.length);
  console.log('  TaskEvent:', taskEvents.length);
  console.log('  Notification (task-related):', notifications.length);
  console.log('Backup written to:', backupPath);

  const results = await Promise.all([
    EmployeeTask.deleteMany({}),
    WorkTeam.deleteMany({}),
    TaskClient.deleteMany({}),
    TaskEvent.deleteMany({}),
    Notification.deleteMany({ type: { $in: TASK_NOTIFICATION_TYPES } }),
  ]);

  console.log('Deleted:');
  console.log('  EmployeeTask:', results[0].deletedCount);
  console.log('  WorkTeam:', results[1].deletedCount);
  console.log('  TaskClient:', results[2].deletedCount);
  console.log('  TaskEvent:', results[3].deletedCount);
  console.log('  Notification (task-related):', results[4].deletedCount);

  console.log('BACKUP_PATH=' + backupPath);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
