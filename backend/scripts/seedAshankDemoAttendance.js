require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');

const Employee = require('../src/models/Employee');
const DevicePunch = require('../src/models/DevicePunch');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const Holiday = require('../src/models/Holiday');
const CompanyEvent = require('../src/models/CompanyEvent');
const attendanceClassifierService = require('../src/services/attendanceClassifier.service');
const attendanceService = require('../src/services/attendance.service');

// One-off demo: creates Ashank Mishra (employeeCode 1111) and fills June
// 2026 with real DevicePunch rows chosen to trigger every case the
// attendance rules distinguish, then runs the actual classifier
// (settleDay) over each day so the resulting AttendanceRecords are
// genuinely produced by the rules engine — not hand-written — for manual
// verification in the UI. Safe to re-run: wipes and rebuilds Ashank's own
// punches/records/company-event demo rows each time, touches no one else.

const YEAR = 2026;
const MONTH = 6; // June
const IST_OFFSET_MIN = 330;

function ist(day, hh, mm) {
  return new Date(Date.UTC(YEAR, MONTH - 1, day, hh, mm - IST_OFFSET_MIN));
}

function dateLabel(day) {
  return new Date(Date.UTC(YEAR, MONTH - 1, day));
}

function dayName(day) {
  return dateLabel(day).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

async function main() {
  await mongoose.connect(env.mongodbUri);

  // ---------------------------------------------------------------------
  // 1. Employee — fixed code 1111, DOB on the 15th so it lands on the same
  //    day as the demo holiday below (birthday + holiday, same day).
  // ---------------------------------------------------------------------
  let ashank = await Employee.findOne({ employeeCode: '1111' });
  if (ashank) {
    console.log('Ashank Mishra already exists, reusing:', ashank._id.toString());
  } else {
    ashank = await Employee.create({
      employeeCode: '1111',
      firstName: 'Ashank',
      lastName: 'Mishra',
      personalEmail: 'ashank.mishra.demo@example.com',
      phone: '9876543210',
      instagramId: 'ashank.mishra',
      permanentAddress: { line1: '221B Demo Lane', city: 'Raipur', state: 'Chhattisgarh', pincode: '492001', country: 'India' },
      localAddress: { line1: '221B Demo Lane', city: 'Raipur', state: 'Chhattisgarh', pincode: '492001', country: 'India' },
      dob: new Date(Date.UTC(2000, MONTH - 1, 15)),
      bloodGroup: 'O+',
      gender: 'Male',
      fatherName: 'Demo Father Mishra',
      designation: 'Software Engineer',
      department: 'Technology',
      dateOfJoining: new Date(Date.UTC(2024, 0, 15)),
      employmentType: 'full-time',
      workingHoursStart: '09:30',
      workingHoursEnd: '18:30',
      ctcAnnual: 600000,
      monthlyPay: 50000,
      bankAccountNumber: '000111222333',
      bankIFSC: 'DEMO0001111',
      bankName: 'Demo Bank',
      payDate: 1,
      panNumber: 'DEMOA1111M',
      aadharNumber: '111122223333',
      status: 'active',
      biometricVerificationAdded: true,
      companyLoginAdded: true,
      officePhoneAdded: false,
      personalPhoneAdded: true,
    });
    console.log('Created Ashank Mishra:', ashank._id.toString());
  }
  const empId = ashank._id;

  // ---------------------------------------------------------------------
  // 2. Clean slate for June 2026 — safe to re-run.
  // ---------------------------------------------------------------------
  const monthStart = dateLabel(1);
  const monthEnd = dateLabel(30);
  const nextMonthStartUTC = new Date(Date.UTC(YEAR, MONTH, 1, 0, -IST_OFFSET_MIN)); // July 1, 00:00 IST
  await DevicePunch.deleteMany({ employee: empId, timestamp: { $gte: ist(1, 0, 0), $lt: nextMonthStartUTC } });
  await AttendanceRecord.deleteMany({ employee: empId, date: { $gte: monthStart, $lte: monthEnd } });

  // ---------------------------------------------------------------------
  // 3. Holiday on the 15th (also Ashank's birthday — tests "a day can be a
  //    birthday as well as a holiday").
  // ---------------------------------------------------------------------
  const holidayDate = dateLabel(15);
  let holiday = await Holiday.findOne({ date: holidayDate });
  if (!holiday) {
    holiday = await Holiday.create({ date: holidayDate, label: 'Demo Holiday (Founders Day)' });
    console.log('Created holiday on the 15th (also Ashank\'s birthday)');
  }

  // ---------------------------------------------------------------------
  // 4. Company events — one of each colour, for the calendar demo.
  // ---------------------------------------------------------------------
  await CompanyEvent.deleteMany({ name: { $in: ['Acme Client Pvt Ltd', 'GoToFriend'] } });
  await CompanyEvent.create([
    { type: 'client_birthday', name: 'Acme Client Pvt Ltd', date: dateLabel(10), notes: 'Demo client birthday' },
    { type: 'client_anniversary', name: 'Acme Client Pvt Ltd', date: dateLabel(20), notes: 'Demo client anniversary' },
    { type: 'brand_anniversary', name: 'GoToFriend', date: dateLabel(25), notes: 'Demo brand anniversary' },
  ]);
  console.log('Created 3 company-event demo entries (client birthday/anniversary, brand anniversary)');

  // ---------------------------------------------------------------------
  // 5. Pick weekday dates (excluding the 15th) and Sundays across June.
  // ---------------------------------------------------------------------
  const weekdays = [];
  const sundays = [];
  for (let d = 1; d <= 30; d += 1) {
    if (d === 15) continue; // reserved for the holiday
    const dow = dateLabel(d).getUTCDay();
    if (dow === 0) sundays.push(d);
    else weekdays.push(d);
  }

  const [
    dPresent, dLate, dShortLeave, dHalfDay, dEarlyDeparture, dOvertime,
    dUnclassified, dSingleScan, dNoScan, dLateAfter2pm, dStacked, dWfhManual,
  ] = weekdays;
  const [dSundayOT, dSundayQuiet] = sundays;

  console.log(`\nJune ${YEAR} weekday pool: ${weekdays.length} days, Sundays: ${sundays.join(', ')}`);

  // ---------------------------------------------------------------------
  // 6. Manual marks FIRST — so the classifier sweep below correctly skips
  //    them (isAutoMarked guard), same as real usage.
  // ---------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${YEAR}-${pad(MONTH)}-${pad(d)}`;

  await attendanceService.markAttendance(empId, iso(dWfhManual), { status: 'W' }, 'admin');
  console.log(`Day ${dWfhManual} (${dayName(dWfhManual)}): manually marked Work From Home by admin (no reason needed)`);

  // HR's manual-edit demo can't live in June — HR is capped at editing
  // attendance no more than 2 days old (see
  // attendance.service.js#assertCanEditAttendanceDate), and June 2026 is
  // long past that window relative to the real system clock. Demonstrated
  // separately below, dated "yesterday" instead.

  // ---------------------------------------------------------------------
  // 7. Biometric punches — one DevicePunch row per scan, exactly like a
  //    real device push (see devicePunch.service.js#recordPunch).
  // ---------------------------------------------------------------------
  const punchRows = [];
  const punch = (day, hh, mm) =>
    punchRows.push({ employeeCode: '1111', employee: empId, timestamp: ist(day, hh, mm), deviceSerial: 'DEMO-SEED', raw: 'seed' });

  punch(dPresent, 9, 20);
  punch(dPresent, 18, 35);

  punch(dLate, 9, 50);
  punch(dLate, 18, 30);

  punch(dShortLeave, 10, 15);
  punch(dShortLeave, 18, 30);

  punch(dHalfDay, 12, 0);
  punch(dHalfDay, 18, 35);

  punch(dEarlyDeparture, 9, 25);
  punch(dEarlyDeparture, 17, 0);

  punch(dOvertime, 9, 30);
  punch(dOvertime, 20, 0);

  // Unclassified: two morning-only scans, last one well before the 4:30pm
  // early-departure floor — departure side never resolves.
  punch(dUnclassified, 9, 0);
  punch(dUnclassified, 11, 0);

  // Single scan only.
  punch(dSingleScan, 9, 30);

  // dNoScan: deliberately no punches at all.

  // First scan of the day after 2pm — new auto-absent rule.
  punch(dLateAfter2pm, 15, 0);

  // Stacked: Late arrival AND Early departure same day (two short-leave
  // equivalents in one day feeding the penalty ladder).
  punch(dStacked, 9, 55);
  punch(dStacked, 17, 15);

  // Sunday overtime: 4 hours, no arrival/departure windows apply.
  punch(dSundayOT, 11, 0);
  punch(dSundayOT, 15, 0);

  // dSundayQuiet: deliberately no punches — a quiet Sunday is normal, not
  // an anomaly, and should produce no record and no notification.

  // Holiday (15th): one punch anyway, to prove the classifier ignores it
  // entirely even though a scan exists.
  punch(15, 9, 30);

  await DevicePunch.insertMany(punchRows);
  console.log(`\nInserted ${punchRows.length} biometric punches across June.`);

  // ---------------------------------------------------------------------
  // 8. Run the REAL classifier over every June day, in order.
  // ---------------------------------------------------------------------
  for (let d = 1; d <= 30; d += 1) {
    // eslint-disable-next-line no-await-in-loop
    await attendanceClassifierService.settleDay(empId, dateLabel(d));
  }
  console.log('Ran settleDay() across all 30 days of June.\n');

  // ---------------------------------------------------------------------
  // 9. Report what actually landed in the DB, for verification.
  // ---------------------------------------------------------------------
  const records = await AttendanceRecord.find({ employee: empId, date: { $gte: monthStart, $lte: monthEnd } }).sort({ date: 1 });
  const recordByDay = new Map(records.map((r) => [r.date.getUTCDate(), r]));

  const labelFor = {
    [dPresent]: 'Present (on-time)',
    [dLate]: 'Late arrival',
    [dShortLeave]: 'Short Leave arrival',
    [dHalfDay]: 'Half Day arrival',
    [dEarlyDeparture]: 'Present + Early Departure',
    [dOvertime]: 'Present + Overtime (1.5h)',
    [dUnclassified]: 'Unclassified (needs manual review — expect NO record)',
    [dSingleScan]: 'Single scan (needs manual review — expect NO record)',
    [dNoScan]: 'No scan at all -> auto Absent',
    [dLateAfter2pm]: 'First scan after 2pm -> auto Absent',
    [dStacked]: 'Late + Early Departure (stacked penalty)',
    [dWfhManual]: 'Manual: Work From Home (admin)',
    [dSundayOT]: 'Sunday worked -> overtime only (4h)',
    [dSundayQuiet]: 'Sunday, no scans -> expect NO record (quiet Sunday)',
    15: 'Holiday + Ashank\'s birthday -> expect NO record even though a scan exists',
  };

  console.log('date       | day        | scenario                                                    | record');
  console.log('-'.repeat(130));
  for (let d = 1; d <= 30; d += 1) {
    const scenario = labelFor[d];
    if (!scenario) continue;
    const r = recordByDay.get(d);
    const summary = r
      ? `status=${r.status ?? '—'} earlyDep=${r.earlyDeparture} ot=${r.overtimeHours}h autoMarked=${r.isAutoMarked} settled=${r.isSettled}${r.notes ? ` notes="${r.notes}"` : ''}`
      : 'NO RECORD (as expected for this case)';
    console.log(`${iso(d)} | ${dayName(d).padEnd(10)} | ${scenario.padEnd(59)} | ${summary}`);
  }

  // ---------------------------------------------------------------------
  // 10. HR-reason requirement, demonstrated on a real "yesterday" date
  //     (HR can't touch June from today — see the note above).
  // ---------------------------------------------------------------------
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let rejected = false;
  try {
    await attendanceService.markAttendance(empId, yesterdayStr, { status: 'O' }, 'hr');
  } catch (err) {
    rejected = true;
    console.log(`\n${yesterdayStr}: HR attempt WITHOUT a reason correctly rejected — "${err.message}"`);
  }
  if (!rejected) throw new Error('HR reason guard did not reject a reason-less manual mark — check attendance.service.js');

  await attendanceService.markAttendance(
    empId,
    yesterdayStr,
    { status: 'O', notes: 'Approved paid leave — Diwali travel (demo reason)' },
    'hr'
  );
  console.log(`${yesterdayStr}: HR manually marked Paid Leave WITH a reason — succeeded, admins notified (check Notifications page).`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
