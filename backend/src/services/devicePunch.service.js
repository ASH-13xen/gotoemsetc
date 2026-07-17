const logger = require('../utils/logger');
const employeeRepository = require('../repositories/employee.repository');
const devicePunchRepository = require('../repositories/devicePunch.repository');
const attendanceClassifierService = require('./attendanceClassifier.service');

// ZKTeco ADMS sends attendance logs as tab-separated lines, one punch per
// line: "PIN\tYYYY-MM-DD HH:mm:ss\tStatus\tVerify\t...". We only need the
// first field (PIN) — the device's own embedded timestamp is deliberately
// ignored (see recordPunch) since these terminals' onboard clocks drift and
// aren't reliably kept in sync.
function parseAttLogLine(line) {
  const fields = line.split('\t');
  const employeeCode = fields[0]?.trim();
  const timestampStr = fields[1]?.trim();
  if (!employeeCode || !timestampStr) return null;

  return { employeeCode };
}

// Uses the server's receipt time rather than the device's embedded
// timestamp — the device's onboard clock can drift out of sync, so "when we
// heard about it" is treated as more trustworthy than "when the device
// thinks it happened".
async function recordPunch(employeeCode, raw, deviceSerial) {
  const employee = await employeeRepository.findByCode(employeeCode);
  const timestamp = new Date();
  const punch = await devicePunchRepository.create({
    employeeCode,
    employee: employee ? employee._id : null,
    timestamp,
    deviceSerial,
    raw,
  });

  // Fire-and-forget — a matched punch drives real-time attendance
  // classification (see attendanceClassifier.service.js), but a slow/failed
  // classification pass should never hold up or fail the device's response.
  if (employee) {
    attendanceClassifierService
      .handlePunchEvent(employee._id, timestamp)
      .catch((err) => logger.error({ err, employeeId: employee._id }, 'handlePunchEvent failed'));
  }

  return punch;
}

// Body is the device's raw POST payload — one or more ATTLOG lines. Bad
// lines are skipped (logged) rather than failing the whole batch, since one
// malformed line shouldn't lose the rest of the punches in the push.
async function processAttLogBody(body, deviceSerial) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let recorded = 0;
  for (const line of lines) {
    const parsed = parseAttLogLine(line);
    if (!parsed) {
      logger.warn({ line }, 'Skipping unparseable ADMS attendance line');
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await recordPunch(parsed.employeeCode, line, deviceSerial);
    recorded += 1;
  }
  return recorded;
}

function listRecent(query) {
  return devicePunchRepository.listRecent(query);
}

module.exports = { processAttLogBody, listRecent };
