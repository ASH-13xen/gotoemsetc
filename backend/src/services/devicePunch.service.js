const logger = require('../utils/logger');
const employeeRepository = require('../repositories/employee.repository');
const devicePunchRepository = require('../repositories/devicePunch.repository');

// ZKTeco ADMS sends attendance logs as tab-separated lines, one punch per
// line: "PIN\tYYYY-MM-DD HH:mm:ss\tStatus\tVerify\t...". We only need the
// first two fields — everything else varies by device model/firmware.
function parseAttLogLine(line) {
  const fields = line.split('\t');
  const employeeCode = fields[0]?.trim();
  const timestampStr = fields[1]?.trim();
  if (!employeeCode || !timestampStr) return null;

  const timestamp = new Date(timestampStr.replace(' ', 'T'));
  if (Number.isNaN(timestamp.getTime())) return null;

  return { employeeCode, timestamp };
}

async function recordPunch(employeeCode, timestamp, raw, deviceSerial) {
  const employee = await employeeRepository.findByCode(employeeCode);
  return devicePunchRepository.create({
    employeeCode,
    employee: employee ? employee._id : null,
    timestamp,
    deviceSerial,
    raw,
  });
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
    await recordPunch(parsed.employeeCode, parsed.timestamp, line, deviceSerial);
    recorded += 1;
  }
  return recorded;
}

function listRecent(query) {
  return devicePunchRepository.listRecent(query);
}

module.exports = { processAttLogBody, listRecent };
