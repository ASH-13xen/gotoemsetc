require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const Employee = require('../src/models/Employee');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const Client = require('../src/models/Client');
const Counter = require('../src/models/Counter');
const { EMPLOYEE_STATUS, ATTENDANCE_STATUS, CLIENT_STATUS } = require('../src/config/constants');

// Mock data for local/dev testing of EMS + Client Management + Birthdays.
// Idempotent: re-running upserts by personalEmail (employees) / clientName
// (clients) instead of duplicating. Does NOT touch Task Management.

const DAY = 24 * 60 * 60 * 1000;
function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function onDate(year, month, day) {
  return new Date(year, month - 1, day);
}
function pick(arr, i) {
  return arr[i % arr.length];
}

async function nextEmployeeCode() {
  const counter = await Counter.findByIdAndUpdate(
    'employeeCode',
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return String(counter.seq);
}

const DESIGNATIONS = [
  { title: 'Content Writer', department: 'Content' },
  { title: 'Content Manager', department: 'Content' },
  { title: 'Social Media Manager', department: 'Marketing' },
  { title: 'Digital Marketer', department: 'Marketing' },
  { title: 'Performance Marketer', department: 'Marketing' },
  { title: 'Videographer', department: 'Video' },
  { title: 'Video Editor', department: 'Video' },
  { title: 'Graphic Designer', department: 'Design' },
  { title: 'Sales Executive', department: 'Sales' },
  { title: 'Operation Manager', department: 'Operations' },
  { title: 'Event Manager', department: 'Operations' },
  { title: 'Executive Assistant', department: 'Admin' },
  { title: 'Finance Executive', department: 'Finance' },
  { title: 'HR Executive', department: 'HR' },
];

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Kabir', 'Rohan', 'Arjun', 'Dev',
  'Sanya', 'Priya', 'Ananya', 'Kavya', 'Diya', 'Meera', 'Riya', 'Sneha',
  'Karan', 'Yash', 'Nikita', 'Simran',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Iyer', 'Nair', 'Khanna', 'Malhotra', 'Reddy',
  'Chopra', 'Bhatt', 'Joshi', 'Rao', 'Kapoor', 'Menon', 'Singh', 'Das',
  'Pillai', 'Agarwal', 'Bose', 'Mehta',
];
const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CITIES = [
  { city: 'Raipur', state: 'Chhattisgarh' },
  { city: 'Bhilai', state: 'Chhattisgarh' },
  { city: 'Nagpur', state: 'Maharashtra' },
  { city: 'Bhopal', state: 'Madhya Pradesh' },
  { city: 'Indore', state: 'Madhya Pradesh' },
];

async function main() {
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB');

  // ---------- Employees ----------
  const today = new Date();
  const joinDates = [];
  const startAgo = 90; // first hire: 3 months ago
  const endAgo = 7; // newest hire: 1 week ago
  for (let i = 0; i < 20; i++) {
    const t = i / 19; // 0..1
    const ago = Math.round(startAgo - t * (startAgo - endAgo));
    joinDates.push(daysAgo(ago));
  }

  const birthdayPool = [
    [7, 14], [7, 18], [7, 22], [8, 2], [1, 5], [2, 14], [3, 30], [4, 9],
    [5, 19], [6, 1], [6, 25], [7, 3], [9, 11], [9, 27], [10, 15], [11, 5],
    [11, 30], [12, 8], [12, 24], [1, 20],
  ];

  const employees = [];
  for (let i = 0; i < 20; i++) {
    const firstName = pick(FIRST_NAMES, i);
    const lastName = pick(LAST_NAMES, i);
    const desig = pick(DESIGNATIONS, i);
    const [bMonth, bDay] = birthdayPool[i];
    const birthYear = 1988 + (i % 15); // ages ~ 22-38 relative to 2026
    const complete = i % 3 !== 0; // ~2/3 fully filled out, rest missing chunks
    const isDraft = i === 5 || i === 12; // a couple still in onboarding
    const isOffboarded = i === 3 || i === 17; // a couple who've left
    const status = isDraft
      ? EMPLOYEE_STATUS.DRAFT
      : isOffboarded
      ? EMPLOYEE_STATUS.OFFBOARDED
      : EMPLOYEE_STATUS.ACTIVE;
    const loc = pick(CITIES, i);
    const monthlyPay = 18000 + (i % 10) * 3500;

    const doc = {
      firstName,
      lastName,
      personalEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@mocktest.example`,
      phone: complete ? `9${String(700000000 + i * 137).slice(0, 9)}` : undefined,
      instagramId: i % 4 === 0 ? undefined : `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
      permanentAddress: complete
        ? {
            line1: `${100 + i} MG Road`,
            city: loc.city,
            state: loc.state,
            pincode: `4920${String(10 + i).slice(-2)}`,
            country: 'India',
          }
        : undefined,
      localAddress: i % 5 === 0 ? undefined : {
        line1: `${20 + i} Civil Lines`,
        city: loc.city,
        state: loc.state,
        pincode: `4920${String(10 + i).slice(-2)}`,
        country: 'India',
      },
      dob: onDate(birthYear, bMonth, bDay),
      bloodGroup: i % 6 === 0 ? undefined : pick(BLOOD_GROUPS, i),
      gender: pick(GENDERS, i % 12 === 0 ? 2 : i % 2), // mostly M/F, a couple Other
      fatherName: i % 7 === 0 ? undefined : `${pick(FIRST_NAMES, i + 3)} ${lastName}`,

      designation: desig.title,
      department: desig.department,
      dateOfJoining: joinDates[i],
      employmentType: i % 9 === 0 ? 'intern' : i % 11 === 0 ? 'contract' : i % 13 === 0 ? 'part-time' : 'full-time',
      reportingManager: i === 0 ? undefined : `${FIRST_NAMES[(i + 5) % 20]} ${LAST_NAMES[(i + 5) % 20]}`,
      workLocation: i % 4 === 3 ? 'Remote' : 'Office',
      ctcAnnual: monthlyPay * 12,
      monthlyPay,
      salaryComponents: complete
        ? [
            { label: 'Basic', monthlyAmount: Math.round(monthlyPay * 0.5) },
            { label: 'HRA', monthlyAmount: Math.round(monthlyPay * 0.2) },
            { label: 'Special Allowance', monthlyAmount: Math.round(monthlyPay * 0.3) },
          ]
        : [],
      bankAccountNumber: isDraft ? undefined : `50100${String(1000000 + i)}`,
      bankIFSC: isDraft ? undefined : 'HDFC0001234',
      bankName: isDraft ? undefined : 'HDFC Bank',
      payDate: pick([1, 5, 7, 10], i),
      panNumber: complete ? `ABCDE${1000 + i}F` : undefined,
      aadharNumber: complete ? `${9000 + i}12345678` : undefined,
      extraDetails: i % 8 === 0 ? [{ key: 'T-Shirt Size', value: pick(['S', 'M', 'L', 'XL'], i) }] : [],

      biometricVerificationAdded: !isDraft && i % 3 !== 0,
      companyLoginAdded: !isDraft,
      officePhoneAdded: !isDraft && i % 2 === 0,
      personalPhoneAdded: complete,

      status,
    };

    employees.push(doc);
  }

  const savedEmployees = [];
  for (const doc of employees) {
    let existing = await Employee.findOne({ personalEmail: doc.personalEmail });
    if (existing) {
      Object.assign(existing, doc);
      await existing.save();
      savedEmployees.push(existing);
    } else {
      doc.employeeCode = await nextEmployeeCode();
      const created = await Employee.create(doc);
      savedEmployees.push(created);
    }
  }
  console.log(`Upserted ${savedEmployees.length} employees`);

  // ---------- Attendance ----------
  // Sundays are implicitly off (per attendance.service.js) — skip them.
  // Draft employees (not onboarded yet) get no attendance history.
  await AttendanceRecord.deleteMany({ employee: { $in: savedEmployees.map((e) => e._id) } });

  const STATUS_WEIGHTS = [
    ...Array(14).fill(ATTENDANCE_STATUS.PRESENT),
    ...Array(2).fill(ATTENDANCE_STATUS.PAID_LEAVE),
    ...Array(1).fill(ATTENDANCE_STATUS.HALF_DAY),
    ...Array(1).fill(ATTENDANCE_STATUS.LATE),
    ...Array(1).fill(ATTENDANCE_STATUS.SHORT_LEAVE),
    ...Array(1).fill(ATTENDANCE_STATUS.WORK_FROM_HOME),
  ];

  let attendanceCount = 0;
  const attendanceOps = [];
  for (const emp of savedEmployees) {
    if (emp.status === EMPLOYEE_STATUS.DRAFT) continue;
    const start = new Date(emp.dateOfJoining);
    const end = emp.status === EMPLOYEE_STATUS.OFFBOARDED ? daysAgo(2) : today;
    let seed = emp.employeeCode ? Number(emp.employeeCode) : 1;

    for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + DAY)) {
      if (cursor.getDay() === 0) continue; // Sunday off
      seed = (seed * 9301 + 49297) % 233280; // deterministic pseudo-random
      const rand = seed / 233280;
      const status = STATUS_WEIGHTS[Math.floor(rand * STATUS_WEIGHTS.length)];
      const overtimeHours = rand > 0.85 ? Math.round(rand * 4) : 0;
      const recordDate = new Date(cursor);
      recordDate.setHours(0, 0, 0, 0);

      attendanceOps.push({
        updateOne: {
          filter: { employee: emp._id, date: recordDate },
          update: {
            $set: {
              employee: emp._id,
              date: recordDate,
              status,
              overtimeHours,
              isBackdated: true,
            },
          },
          upsert: true,
        },
      });
      attendanceCount++;
    }
  }
  if (attendanceOps.length) {
    // Mongo bulkWrite has a practical batch-size comfort limit; chunk it.
    for (let i = 0; i < attendanceOps.length; i += 1000) {
      await AttendanceRecord.bulkWrite(attendanceOps.slice(i, i + 1000));
    }
  }
  console.log(`Upserted ${attendanceCount} attendance records`);

  // ---------- Clients ----------
  const activeEmployees = savedEmployees.filter((e) => e.status === EMPLOYEE_STATUS.ACTIVE);

  const CLIENT_DEFS = [
    { clientName: 'Nova Threads Pvt Ltd', brandName: 'Nova Threads', status: CLIENT_STATUS.ONBOARDED, contacts: 2, assign: 3, registeredDaysAgo: 120 },
    { clientName: 'Bistro Bloom Cafe', brandName: 'Bistro Bloom', status: CLIENT_STATUS.ONBOARDED, contacts: 1, assign: 2, registeredDaysAgo: 95 },
    { clientName: 'Peak Fitness Studios', brandName: 'Peak Fitness', status: CLIENT_STATUS.ONBOARDED, contacts: 1, assign: 1, registeredDaysAgo: 80 },
    { clientName: 'Aurelia Skincare', brandName: 'Aurelia', status: CLIENT_STATUS.ONBOARDED, contacts: 2, assign: 2, registeredDaysAgo: 60 },
    { clientName: 'Sunridge Realty Group', brandName: 'Sunridge Realty', status: CLIENT_STATUS.LEAD, contacts: 1, assign: 0, registeredDaysAgo: 20 },
    { clientName: 'Verve Motors', brandName: 'Verve Motors', status: CLIENT_STATUS.LEAD, contacts: 0, assign: 0, registeredDaysAgo: 10 },
    { clientName: 'Little Sprouts Preschool', brandName: 'Little Sprouts', status: CLIENT_STATUS.LEAD, contacts: 1, assign: 1, registeredDaysAgo: 35 },
    { clientName: 'Copper Kettle Brewhouse', brandName: 'Copper Kettle', status: CLIENT_STATUS.ONBOARDED, contacts: 1, assign: 3, registeredDaysAgo: 150 },
    { clientName: 'Horizon Legal Associates', brandName: 'Horizon Legal', status: CLIENT_STATUS.OFFBOARDED, contacts: 1, assign: 1, registeredDaysAgo: 200 },
    { clientName: 'Pixel Forge Studios', brandName: 'Pixel Forge', status: CLIENT_STATUS.LEAD, contacts: 0, assign: 0, registeredDaysAgo: 5 },
  ];

  const CONTACT_ROLES = ['Owner', 'Marketing Head', 'Founder', 'Manager', 'CEO'];
  let empCursor = 0;

  let clientCount = 0;
  for (let i = 0; i < CLIENT_DEFS.length; i++) {
    const def = CLIENT_DEFS[i];
    const contacts = [];
    for (let c = 0; c < def.contacts; c++) {
      contacts.push({
        name: `${pick(FIRST_NAMES, i + c + 5)} ${pick(LAST_NAMES, i + c + 5)}`,
        role: pick(CONTACT_ROLES, i + c),
        email: `contact${c}@${def.brandName.toLowerCase().replace(/\s+/g, '')}.example`,
        phone: c === 0 ? `9${String(800000000 + i * 211).slice(0, 9)}` : undefined,
      });
    }

    const assigned = [];
    for (let a = 0; a < def.assign && activeEmployees.length; a++) {
      assigned.push(activeEmployees[empCursor % activeEmployees.length]._id);
      empCursor++;
    }
    const mainEmployee = assigned.length ? assigned[0] : undefined;
    const onboardedAt = def.status === CLIENT_STATUS.ONBOARDED || def.status === CLIENT_STATUS.OFFBOARDED
      ? daysAgo(Math.max(def.registeredDaysAgo - 10, 1))
      : undefined;

    const doc = {
      clientName: def.clientName,
      brandName: def.brandName,
      dateRegistered: daysAgo(def.registeredDaysAgo),
      logoUrl: i % 4 === 0 ? undefined : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(def.brandName)}`,
      contacts,
      status: def.status,
      onboardedAt,
      assignedEmployees: assigned,
      mainEmployee,
    };

    let existing = await Client.findOne({ clientName: def.clientName });
    if (existing) {
      Object.assign(existing, doc);
      await existing.save();
    } else {
      await Client.create(doc);
    }
    clientCount++;
  }
  console.log(`Upserted ${clientCount} clients`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
