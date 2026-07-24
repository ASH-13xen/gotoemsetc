require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../src/config/env');

const Employee = require('../src/models/Employee');
const User = require('../src/models/User');
const ActivityLog = require('../src/models/ActivityLog');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const DevicePunch = require('../src/models/DevicePunch');
const Counter = require('../src/models/Counter');

// One-time import from the HR "back office" Google Sheet export
// (frontendems/public/EMPLOYEE BACK OFFICE SHEET - EMPLOYEE DETAILS.csv).
// That sheet is a transposed export (one row per field, one column per
// employee) glued together from three separate sub-sheets — an old/stale
// roster with no biometric code (columns 1-77), and two "current roster"
// blocks that actually carry live profile data and mostly have a
// biometric/employee code (columns 79-93 and 96-126, each preceded by a
// literal "Z" divider column). Per instruction, the biometric ID is the
// one and only identifier employees have in this system now, so only the
// two coded/current blocks are imported — see the column ranges below.
//
// Confirmed with the requester before running:
//  - Only the 45 people in the "current roster" blocks are imported; the
//    69 stale, code-less, no-data names in the old block are skipped.
//  - VED RAJWADE appears twice in the current blocks (col 82: code 1009,
//    active; col 86: no code, "Converted into Payroll", offboarded) — the
//    coded/active entry (col 82) is kept, the other dropped.
//  - Employees with an end date (or other clear offboarding signal) are
//    imported with status 'offboarded'.

// Kept in backend/storage/ (gitignored, not served by any frontend) rather
// than frontendems/public/ — that folder is copied verbatim into the built
// frontend, which would have made this file (aadhar/PAN numbers, personal
// phone numbers, and plaintext Gmail passwords for every employee) publicly
// downloadable the moment the app was deployed.
const CSV_PATH = path.join(__dirname, '..', 'storage', 'EMPLOYEE BACK OFFICE SHEET - EMPLOYEE DETAILS.csv');

// ---------------------------------------------------------------------------
// RFC4180 CSV parser — hand-rolled because this sheet has quoted fields with
// embedded commas AND embedded newlines (e.g. multi-line header labels), so
// a naive line-split misaligns every row after the first quoted newline.
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (c === '\r') {
      i++;
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
    } else {
      field += c;
      i++;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Field normalization helpers — the sheet uses "NA" as a placeholder for
// "no data" everywhere, mixes at least 5 different date-separator styles,
// and represents booleans as TRUE/FALSE/YES/blank/"IN PROGRESS".
// ---------------------------------------------------------------------------
function isBlank(v) {
  if (v == null) return true;
  const t = String(v).trim();
  if (!t) return true;
  const u = t.toUpperCase();
  return u === 'NA' || u === 'N/A';
}

function toBool(v) {
  if (isBlank(v)) return false;
  const u = String(v).trim().toUpperCase();
  return u === 'TRUE' || u === 'YES';
}

// Handles D/M/Y with '/', '.', '-' or '\' separators, 2- or 4-digit years,
// and "date1 | date2" (takes the first/earlier date). Rejects impossible
// calendar dates (e.g. 31 April) instead of letting JS silently roll them
// into the next month.
function parseIndianDate(raw, problems, context) {
  if (isBlank(raw)) return undefined;
  const first = String(raw).split('|')[0].trim();
  const m = first.match(/^(\d{1,2})[/.\-\\](\d{1,2})[/.\-\\](\d{2,4})$/);
  if (!m) {
    problems.push(`${context}: unparseable date "${raw}" — left blank`);
    return undefined;
  }
  let [, d, mo, y] = m;
  d = Number(d);
  mo = Number(mo);
  y = Number(y);
  if (y < 100) y = y <= 30 ? 2000 + y : 1900 + y;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    problems.push(`${context}: invalid calendar date "${raw}" — left blank`);
    return undefined;
  }
  return dt;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
function normalizeBloodGroup(raw, problems, context) {
  if (isBlank(raw)) return undefined;
  const v = String(raw).trim().toUpperCase().replace(/VE$/, '').replace(/^0/, 'O').trim();
  if (BLOOD_GROUPS.includes(v)) return v;
  problems.push(`${context}: unrecognized blood group "${raw}" — left blank`);
  return undefined;
}

function splitName(raw) {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || undefined };
}

function isSameAsAbove(raw) {
  return /^same\b/i.test(raw.trim());
}

function looksLikeEmail(raw) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const problems = [];
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(raw);

  const FIELD_ROW = {
    name: 0,
    designation: 1,
    employeeCode: 6,
    personalPhone: 26,
    officePhone: 27,
    emergencyNumber: 33,
    permanentAddress: 34,
    raipurAddress: 35,
    personalMail: 36,
    companyMailId: 37,
    gmailPassword: 38,
    instaId: 39,
    accessOfAsset: 44,
    bloodGroup: 45,
    dob: 46,
    startDay: 47,
    updatedIn12345: 48,
    endDate: 50,
    reasonForLeaving: 51,
    removeGrpsReels: 52,
    deactivateMail: 53,
  };

  // Column ranges for the two "current roster" blocks — see header comment.
  const targetCols = [];
  for (let c = 79; c <= 93; c++) targetCols.push(c);
  for (let c = 96; c <= 126; c++) targetCols.push(c);
  const dropCols = new Set([86]); // stale VED RAJWADE duplicate — see header comment

  const employeesToInsert = [];

  for (const c of targetCols) {
    if (dropCols.has(c)) continue;
    const get = (key) => (rows[FIELD_ROW[key]][c] ?? '').trim();

    const nameRaw = get('name');
    if (!nameRaw || nameRaw === 'Z') continue;
    const { firstName, lastName } = splitName(nameRaw);
    const context = nameRaw;

    let designation = get('designation');
    if (isBlank(designation)) {
      problems.push(`${context}: no designation in sheet — set to "NOT SPECIFIED"`);
      designation = 'NOT SPECIFIED';
    } else {
      designation = designation.toUpperCase();
    }

    const codeRaw = get('employeeCode');
    const code = isBlank(codeRaw) ? undefined : codeRaw;

    const personalMailRaw = get('personalMail');
    let personalEmail;
    if (!isBlank(personalMailRaw)) {
      personalEmail = personalMailRaw.trim();
      if (!looksLikeEmail(personalEmail)) {
        problems.push(`${context}: personal email "${personalEmail}" doesn't look valid — imported as-is`);
      }
    }

    const companyMailIdRaw = get('companyMailId');
    if (!isBlank(companyMailIdRaw) && !looksLikeEmail(companyMailIdRaw)) {
      problems.push(`${context}: company mail id "${companyMailIdRaw}" doesn't look valid — imported as-is`);
    }

    const permanentAddressRaw = get('permanentAddress');
    const permanentAddress = isBlank(permanentAddressRaw) ? undefined : { line1: permanentAddressRaw };

    const raipurAddressRaw = get('raipurAddress');
    let localAddress;
    if (!isBlank(raipurAddressRaw)) {
      localAddress = isSameAsAbove(raipurAddressRaw) ? (permanentAddress ? { ...permanentAddress } : undefined) : { line1: raipurAddressRaw };
    }

    const dob = parseIndianDate(get('dob'), problems, `${context} (DOB)`);
    const dateOfJoining = parseIndianDate(get('startDay'), problems, `${context} (start day)`);
    const bloodGroup = normalizeBloodGroup(get('bloodGroup'), problems, context);

    const endDateRaw = get('endDate');
    const endDate = parseIndianDate(endDateRaw, problems, `${context} (end date)`);
    const reasonRaw = get('reasonForLeaving');
    const reasonForLeaving = isBlank(reasonRaw) ? undefined : reasonRaw;
    const removeGrpsReelsRaw = get('removeGrpsReels');
    const deactivateMailRaw = get('deactivateMail');
    const removedFromGroupsAndReels = toBool(removeGrpsReelsRaw);
    const mailDeactivated = toBool(deactivateMailRaw);
    if (deactivateMailRaw.trim().toUpperCase() === 'IN PROGRESS') {
      problems.push(`${context}: "Deactivate Mail" is marked IN PROGRESS in the sheet — imported as not-yet-done (false)`);
    }

    const status = reasonForLeaving || endDate || removedFromGroupsAndReels || mailDeactivated ? 'offboarded' : 'active';

    const phoneRaw = get('personalPhone');
    const phone = isBlank(phoneRaw) ? undefined : phoneRaw;
    const instaRaw = get('instaId');
    const instagramId = isBlank(instaRaw) ? undefined : instaRaw;

    const extraDetails = [
      { key: 'OFFICE PHONE NUMBER', value: isBlank(get('officePhone')) ? '' : get('officePhone') },
      { key: 'EMERGENCY NUMBER', value: isBlank(get('emergencyNumber')) ? '' : get('emergencyNumber') },
      { key: 'COMPANY MAIL ID', value: isBlank(companyMailIdRaw) ? '' : companyMailIdRaw },
      { key: 'COMPANY MAIL PASSWORD', value: isBlank(get('gmailPassword')) ? '' : get('gmailPassword') },
    ];

    const doc = {
      firstName,
      lastName,
      designation,
      status,
      personalEmail,
      phone,
      instagramId,
      permanentAddress,
      localAddress,
      dob,
      bloodGroup,
      dateOfJoining,
      extraDetails,
      assetAccessAdded: toBool(get('accessOfAsset')),
      updatedIn12345: toBool(get('updatedIn12345')),
      endDate,
      reasonForLeaving,
      removedFromGroupsAndReels,
      mailDeactivated,
      ...(code ? { employeeCode: code } : {}),
    };

    if (!code) {
      problems.push(`${context}: no biometric/employee code in sheet — imported without one`);
    }

    employeesToInsert.push(doc);
  }

  // Sanity check before touching the DB — duplicate codes would violate the
  // unique index and abort the insert partway through.
  const codes = employeesToInsert.map((e) => e.employeeCode).filter(Boolean);
  const dupCodes = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dupCodes.length) {
    console.error('Duplicate employee codes detected, aborting:', dupCodes);
    process.exit(1);
  }

  console.log(`Parsed ${employeesToInsert.length} employees to import.`);
  console.log(`Problems flagged during parsing: ${problems.length}`);
  problems.forEach((p) => console.log(' -', p));

  if (process.env.DRY_RUN) {
    fs.writeFileSync(path.join(__dirname, 'dryRunOutput.json'), JSON.stringify(employeesToInsert, null, 2));
    console.log('DRY_RUN set — wrote parsed docs to scripts/dryRunOutput.json, skipping DB writes.');
    return;
  }

  await mongoose.connect(env.mongodbUri);

  const oldIds = await Employee.find({}).distinct('_id');
  const wipeResults = {};
  wipeResults.employees = (await Employee.deleteMany({})).deletedCount;
  wipeResults.employeeUsers = (await User.deleteMany({ employeeLink: { $in: oldIds } })).deletedCount;
  wipeResults.activityLogs = (await ActivityLog.deleteMany({ employee: { $in: oldIds } })).deletedCount;
  wipeResults.attendanceRecords = (await AttendanceRecord.deleteMany({ employee: { $in: oldIds } })).deletedCount;
  // DevicePunch is keyed by the biometric device PIN (not an Employee
  // ObjectId) — left in place it would collide with newly-imported
  // employees that happen to reuse the same PIN range, misattributing old
  // punches to the wrong new person. Cleared entirely for that reason.
  wipeResults.devicePunches = (await DevicePunch.deleteMany({})).deletedCount;
  console.log('Wiped existing employee data:', wipeResults);

  const inserted = await Employee.insertMany(employeesToInsert);
  console.log(`Inserted ${inserted.length} employees.`);

  const maxCode = Math.max(...codes.map(Number));
  await Counter.findByIdAndUpdate('employeeCode', { $set: { seq: maxCode } }, { upsert: true });
  console.log(`employeeCode counter reset to ${maxCode} — next auto-generated value will be ${maxCode + 1}.`);

  const activeCount = inserted.filter((e) => e.status === 'active').length;
  const offboardedCount = inserted.filter((e) => e.status === 'offboarded').length;
  console.log(`Active: ${activeCount}, Offboarded: ${offboardedCount}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
