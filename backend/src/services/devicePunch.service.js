const logger = require('../utils/logger');
const employeeRepository = require('../repositories/employee.repository');
const devicePunchRepository = require('../repositories/devicePunch.repository');

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
  return devicePunchRepository.create({
    employeeCode,
    employee: employee ? employee._id : null,
    timestamp: new Date(),
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
    await recordPunch(parsed.employeeCode, line, deviceSerial);
    recorded += 1;
  }
  return recorded;
}

function listRecent(query) {
  return devicePunchRepository.listRecent(query);
}

module.exports = { processAttLogBody, listRecent };
