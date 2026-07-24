require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');

const Employee = require('../src/models/Employee');
const Applicant = require('../src/models/Applicant');
const Interview = require('../src/models/Interview');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const AttendanceModificationRequest = require('../src/models/AttendanceModificationRequest');
const DevicePunch = require('../src/models/DevicePunch');
const GeneratedDocument = require('../src/models/GeneratedDocument');
const SalarySlip = require('../src/models/SalarySlip');
const UploadRequest = require('../src/models/UploadRequest');
const UploadedDocument = require('../src/models/UploadedDocument');
const ActivityLog = require('../src/models/ActivityLog');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');
const Counter = require('../src/models/Counter');

// EMS-only reset: wipes every employee/applicant/attendance/document/payroll
// record so a real company can start clean, without touching CMS (Client*),
// Task Management (Team/Task/StepLibrary), Inventory, Events, Holidays, or
// Document Templates — those are left exactly as they are.
//
// NOT deleted, deliberately:
//   - Holiday / DocumentTemplate — company config/assets, not "employee data"
//   - User accounts with no employeeLink (admin, hr, worker1-3 seed logins)
//     — deleting these would break the ability to log in at all
//
// Known side effect: other modules that reference Employee IDs (CMS client
// assignedEmployees/mainEmployee/chatAllowedEmployees, Meeting.attendees,
// Task/Team member & attribution fields, EventResponsibility assignees,
// InventoryBooking.bookedBy) will be left with dangling ObjectId references
// once their Employees are gone, since this script intentionally never
// touches those collections. Nothing in the code crashes on a missing ref
// (populate() just returns null / lookups no-op), but those views may show
// blank "employee" fields on that leftover CMS/Task/Inventory/Event test
// data. Flagged before running, not fixed by this script.
async function main() {
  await mongoose.connect(env.mongodbUri);

  const employeeIds = await Employee.find({}).distinct('_id');

  const results = {};
  results.employees = (await Employee.deleteMany({})).deletedCount;
  results.applicants = (await Applicant.deleteMany({})).deletedCount;
  results.interviews = (await Interview.deleteMany({})).deletedCount;
  results.attendanceRecords = (await AttendanceRecord.deleteMany({})).deletedCount;
  results.attendanceModificationRequests = (await AttendanceModificationRequest.deleteMany({})).deletedCount;
  results.devicePunches = (await DevicePunch.deleteMany({})).deletedCount;
  results.generatedDocuments = (await GeneratedDocument.deleteMany({})).deletedCount;
  results.salarySlips = (await SalarySlip.deleteMany({})).deletedCount;
  results.uploadRequests = (await UploadRequest.deleteMany({})).deletedCount;
  results.uploadedDocuments = (await UploadedDocument.deleteMany({})).deletedCount;
  results.activityLogs = (await ActivityLog.deleteMany({})).deletedCount;

  // Only employee-linked credentials — admin/hr/permission-only worker
  // logins have no employeeLink and are preserved so login keeps working.
  results.employeeCredentials = (await User.deleteMany({ employeeLink: { $in: employeeIds } })).deletedCount;

  results.notifications = (
    await Notification.deleteMany({
      $or: [
        { employee: { $ne: null } },
        { applicant: { $ne: null } },
        { interview: { $ne: null } },
        {
          type: {
            $in: [
              'interview_scheduled',
              'interview_reminder',
              'birthday_upcoming',
              'birthday_today',
              'attendance_no_scan',
              'attendance_single_scan',
              'attendance_unclassified',
              'attendance_modification_requested',
            ],
          },
        },
      ],
    })
  ).deletedCount;

  results.auditLogs = (await AuditLog.deleteMany({ resourceType: { $in: ['Employee', 'SalarySlip'] } })).deletedCount;

  // Reset the sequence so the next employee created starts completely
  // fresh — seeded to 1000 (first hire = 1001), matching the original
  // bootstrap.
  await Counter.findByIdAndUpdate('employeeCode', { $set: { seq: 1000 } }, { upsert: true });

  console.log('EMS data wipe complete:');
  console.log(results);
  console.log('Counter reset — next employeeCode: 1001.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
