require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../src/config/env');

const Employee = require('../src/models/Employee');
const AttendanceRecord = require('../src/models/AttendanceRecord');

// One-time import from the "FINANCIAL TRACKING - ATTENDANCE" Google Sheet
// export (backend/storage/FINANCIAL TRACKING - ATTENDANCE.csv). That sheet
// is a wide, one-row-per-employee / one-column-per-day tracker spanning
// 2024-05-01 through 2026-07-31, built from 3 legend/date header rows plus
// one data row per employee, with per-month "Z"-style divider/legend
// columns interspersed (skipped by the date-column validator below).
//
// Per instruction: only import through 2026-07-21 ("today") — the sheet's
// last 10 columns (Jul 22-31, 2026) are future and untouched. Row matching
// against the 45 currently-imported employees, and the exact row chosen for
// ambiguous/duplicate names, was worked out and confirmed by hand — see
// EMPLOYEE_ROW_MAP below and the accompanying report for details (several
// employees share a first name with an unrelated legacy person elsewhere in
// the sheet; a few have two rows because the sheet itself restarted their
// row partway through).
//
// Ignore rows after (0-indexed) row 139 — spreadsheet row 140 — per
// instruction; everything from row 140 (0-indexed) onward is a stale
// duplicate name list with zero attendance data.

const CSV_PATH = path.join(__dirname, '..', 'storage', 'FINANCIAL TRACKING - ATTENDANCE.csv');
const TODAY_ISO = '2026-07-21';

// Scope knobs for re-running against a subset — set MIN_DATE_ISO/MAX_DATE_ISO
// to bound which columns get imported, and INCLUDE_ONLY to an array of
// uppercased "FIRSTNAME LASTNAME" strings to import just those employees
// (null = everyone in EMPLOYEE_ROW_MAP). Whatever is NOT in scope this run
// still gets wiped — see main()'s "remove all attendance" step, which always
// clears every AttendanceRecord in the collection before re-importing only
// what's in scope.
const MIN_DATE_ISO = '2026-06-01';
const MAX_DATE_ISO = '2026-07-31';
const INCLUDE_ONLY = [
  'SHUBHAM SAHU', 'VED RAJWADE', 'RAJNIGANDHA OJHA', 'ANAMIKA SONWANI', 'JUHIKA PARADKAR',
  'BHAVINI SINGH', 'MONIKA AGARWAL', 'ADITYA SINGH', 'ARVIND KUMAR BAANDHE', 'UDDESHY MISHRA',
  'OM BADLIKAMANI', 'SHIV SHANKAR KUMAR', 'SHREEVIDYA SINGH PARIHAR', 'MUSKAN SACHDEV',
  'HARSHPREET KAUR CHHABRA', 'CHANCHAL MATHARU', 'SAUBHAGYA SAHU', 'HARSHITA BUDHICHA',
  'YUKTA DAGA', 'SUYASH KESHRI', 'PRIYANKA YOGI', 'MAHAK QURESHI', 'MONALI SHARMA',
  'MAHAK AMULANI', 'HARLEEN KAUR KHALSA', 'SHREYANSH', 'MANSI VISHWAKARMA', 'DEVYANSHI',
  'VANSHIKA', 'PRIYANSHA PRADHAN',
]; // "SHAILU" requested too but has no matching Employee record — see report

// ---------------------------------------------------------------------------
// RFC4180 CSV parser — see importEmployeesFromCsv.js for why this is
// hand-rolled instead of a naive line-split.
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

const MONTHS = {
  JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5, JULY: 6,
  AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOV: 10, NOVEMBER: 10, DEC: 11, DECEMBER: 11,
};

// Builds the column -> real calendar date map, skipping legend/divider
// columns (recognizable because their "day" header cell isn't a plain 1-2
// digit number).
//
// At several month boundaries in the source sheet (confirmed: Sep->Oct and
// Oct->Nov 2024) the month-name label sits one column AFTER the column that
// actually holds day 1 — a merged-cell export quirk, not consistent across
// every boundary. Trusting the label at face value column-by-column mis-
// dates that first column (it silently inherits the previous month). To be
// robust against this without manually auditing all ~27 month boundaries in
// the sheet, dates are built in two passes instead of a single left-to-right
// scan: group columns into "segments" wherever the day number increases
// contiguously (a gap or a same-or-lower day number starts a new segment),
// then assign each whole segment whatever month label appears ANYWHERE
// inside it (falling back to previous-segment-plus-one when a segment has
// no label of its own, e.g. a run entirely inside one already-known month).
function buildDateColumns(monthRow, dayRow) {
  const segments = [];
  let seg = null;
  let lastDay = null;
  for (let c = 2; c < dayRow.length; c++) {
    const dayText = (dayRow[c] || '').trim();
    if (!/^\d{1,2}$/.test(dayText)) {
      seg = null;
      lastDay = null;
      continue;
    }
    const day = Number(dayText);
    const moText = (monthRow[c] || '').trim().toUpperCase();
    if (!seg || (lastDay !== null && day <= lastDay)) {
      seg = [];
      segments.push(seg);
    }
    seg.push({ c, day, moText });
    lastDay = day;
  }

  let curMonth = null;
  let curYear = 2024;
  const out = [];
  for (const segment of segments) {
    const labeled = segment.find((e) => MONTHS[e.moText] !== undefined);
    if (labeled) {
      const idx = MONTHS[labeled.moText];
      if (curMonth !== null && idx < curMonth) curYear++; // Dec -> Jan wrap
      curMonth = idx;
    } else if (curMonth !== null) {
      curMonth++;
      if (curMonth > 11) {
        curMonth = 0;
        curYear++;
      }
    } else {
      continue; // no month context yet — shouldn't happen past column 2
    }
    for (const entry of segment) {
      const dt = new Date(Date.UTC(curYear, curMonth, entry.day));
      out.push({ c: entry.c, iso: dt.toISOString().slice(0, 10), date: dt });
    }
  }
  return out;
}

// Sheet legend: P-PRESENT, A-ABSENT (UNPAID LEAVE), H-HALF DAY, L-LATE,
// O-PAID OFF, SL-SHORT LEAVE, W-WORK FROM HOME, NA-NOT APPLICABLE. The app's
// ATTENDANCE_STATUS enum has no "Absent" value (an unmarked day already
// means no record), so 'A' cells cannot be imported as a status — tracked
// separately as a known gap between the sheet and the schema.
const STATUS_MAP = { P: 'P', O: 'O', H: 'H', L: 'L', SL: 'SL', W: 'W' };
const NOT_APPLICABLE = new Set(['NA', '-']); // deliberate "no data expected" markers, not gaps

// Employee full name -> sheet row(s), 0-indexed. Two rows means the sheet
// itself restarted that person's row partway through (confirmed no
// overlapping real data — see report); later row wins when both have a
// value for the same date, otherwise values are merged.
const EMPLOYEE_ROW_MAP = {
  'ADITYA SINGH': [113],
  'AKSHAT JAKHMOLA': [101],
  'ANAMIKA SONWANI': [109],
  'ARVIND KUMAR BAANDHE': [114],
  'BHAVINI SINGH': [111],
  'BHUMI PINJANI': [105],
  'CHANCHAL MATHARU': [122],
  'DEVYANSHI': [134],
  'DRITI GUPTA': [100],
  'HARDIK TAUNK': [139],
  'HARLEEN KAUR KHALSA': [131],
  'HARSH TIWARI': [],
  'HARSHITA BUDHICHA': [124],
  'HARSHPREET KAUR CHHABRA': [121],
  'JUHIKA PARADKAR': [110],
  'LAXMI NARSIMHA': [102],
  'MAHAK AMULANI': [130],
  'MAHAK QURESHI': [128],
  'MANSI VISHWAKARMA': [133],
  'MONALI SHARMA': [129],
  'MONIKA AGARWAL': [112],
  'MUSKAN SACHDEV': [120],
  'OM BADLIKAMANI': [117],
  'PRAKHAR AGRAWAL': [],
  'PRIYANKA YOGI': [127],
  'PRIYANSHA PRADHAN': [136],
  'RAJNIGANDHA OJHA': [108],
  'SAHARSH SINGH SALUJA': [84],
  'SAKSHAM GUPTA': [98],
  'SAUBHAGYA SAHU': [123],
  'SHIV SHANKAR KUMAR': [118],
  'SHREEVIDYA SINGH PARIHAR': [119],
  'SHREYA SINGH RAJPUT': [99],
  'SHREYANSH': [132],
  'SHUBHAM SAHU': [106],
  'SUYASH KESHRI': [126],
  'TANISHKA KEDIA': [],
  'TANYA KRISHNANI': [103],
  'UDDESHY MISHRA': [115],
  'UDITA BOSE': [96],
  'VANSHIKA': [135],
  'VED RAJWADE': [104, 107],
  'VISHAL DUTTA': [],
  'YOGESH DAS': [137],
  'YUKTA DAGA': [125],
};

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(raw);
  const dateCols = buildDateColumns(rows[1], rows[2]).filter(
    (d) => d.iso <= TODAY_ISO && d.iso >= MIN_DATE_ISO && d.iso <= MAX_DATE_ISO
  );

  await mongoose.connect(env.mongodbUri);
  let employees = await Employee.find({}).select('firstName lastName dateOfJoining status');
  if (INCLUDE_ONLY) {
    const wanted = new Set(INCLUDE_ONLY);
    employees = employees.filter((e) => wanted.has(`${e.firstName} ${e.lastName || ''}`.trim().toUpperCase()));
  }

  const recordsToInsert = [];
  const report = []; // per-employee summary

  for (const emp of employees) {
    const fullName = `${emp.firstName} ${emp.lastName || ''}`.trim().toUpperCase();
    const sheetRows = EMPLOYEE_ROW_MAP[fullName];
    const entry = { name: fullName, id: emp._id.toString() };

    if (sheetRows === undefined) {
      entry.problem = 'not found in EMPLOYEE_ROW_MAP (new employee added since this script was written?)';
      report.push(entry);
      continue;
    }
    if (sheetRows.length === 0) {
      entry.problem = 'no matching row found in the attendance sheet — no attendance imported';
      report.push(entry);
      continue;
    }

    // Merge multiple rows for one employee: later row in the list wins
    // whenever it has a non-blank value for a given date.
    const cellFor = (colIdx) => {
      let v = '';
      for (const r of sheetRows) {
        const cell = (rows[r][colIdx] || '').trim();
        if (cell) v = cell;
      }
      return v;
    };

    let startIso = emp.dateOfJoining ? emp.dateOfJoining.toISOString().slice(0, 10) : null;
    let startInferred = false;
    if (!startIso) {
      // No dateOfJoining on file — use the first real status code found in
      // the sheet as a proxy start date, flagged in the report.
      const firstReal = dateCols.find((d) => STATUS_MAP[cellFor(d.c).toUpperCase()]);
      if (firstReal) {
        startIso = firstReal.iso;
        startInferred = true;
      }
    }

    if (!startIso) {
      entry.problem = 'no dateOfJoining on file and no attendance data found to infer one from';
      report.push(entry);
      continue;
    }

    entry.startIso = startIso;
    entry.startInferred = startInferred;
    entry.statusCounts = {};
    entry.unmappedAbsentDays = 0;
    entry.gapDates = [];

    for (const col of dateCols) {
      if (col.iso < startIso) continue; // before they joined — left empty, per instruction
      const raw = cellFor(col.c);
      const upper = raw.toUpperCase();

      if (!raw) {
        entry.gapDates.push(col.iso);
        continue;
      }
      if (NOT_APPLICABLE.has(upper)) continue; // deliberate "n/a" marker, not a gap
      const status = STATUS_MAP[upper];
      if (status) {
        entry.statusCounts[status] = (entry.statusCounts[status] || 0) + 1;
        recordsToInsert.push({
          employee: emp._id,
          date: col.date,
          status,
          isBackdated: col.iso < TODAY_ISO,
        });
        continue;
      }
      if (upper === 'A') {
        entry.unmappedAbsentDays++;
        continue;
      }
      // Anything else (stray numbers, "X", etc.) — unrecognized, not
      // imported, not counted as a gap either (it's not blank, just junk).
      entry.unrecognized = entry.unrecognized || [];
      entry.unrecognized.push({ date: col.iso, value: raw });
    }

    report.push(entry);
  }

  console.log(`Prepared ${recordsToInsert.length} attendance records across ${report.filter((e) => !e.problem).length} employees.`);
  // Kept in backend/storage/ (gitignored) rather than scripts/ (tracked) —
  // this is real per-employee attendance data, not code.
  fs.writeFileSync(path.join(__dirname, '..', 'storage', 'attendanceReport.json'), JSON.stringify(report, null, 2));
  console.log('Full per-employee report written to storage/attendanceReport.json');

  if (process.env.DRY_RUN) {
    console.log('DRY_RUN set — skipping DB writes.');
    await mongoose.disconnect();
    return;
  }

  // "Remove all attendance" always clears the WHOLE collection, not just
  // records for employees in scope this run (INCLUDE_ONLY/date range above
  // narrow what gets re-imported, not what gets wiped first).
  const del = await AttendanceRecord.deleteMany({});
  console.log(`Cleared ${del.deletedCount} attendance records (entire collection) before import.`);

  if (recordsToInsert.length) {
    const inserted = await AttendanceRecord.insertMany(recordsToInsert, { ordered: false });
    console.log(`Inserted ${inserted.length} attendance records.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
