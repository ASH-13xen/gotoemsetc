const asyncHandler = require('../utils/asyncHandler');
const devicePunchService = require('../services/devicePunch.service');
const logger = require('../utils/logger');

// Device handshake — it hits this once on boot/reconnect to check the
// server is reachable before it starts pushing data.
const handshake = asyncHandler(async (req, res) => {
  res.type('text/plain').send('OK');
});

// Device polls this periodically for queued remote commands — we don't
// issue any, so always answer with none pending.
const getRequest = asyncHandler(async (req, res) => {
  res.type('text/plain').send('OK');
});

// The actual attendance push: POST /iclock/cdata?SN=<serial>&table=ATTLOG
const pushData = asyncHandler(async (req, res) => {
  const deviceSerial = req.query.SN;
  const table = req.query.table;

  if (table && table !== 'ATTLOG') {
    // OPERLOG / userinfo / other tables the device also pushes — we don't
    // process them, but still ack so the device doesn't keep retrying.
    return res.type('text/plain').send('OK');
  }

  const recorded = await devicePunchService.processAttLogBody(req.body, deviceSerial);
  logger.info({ deviceSerial, recorded }, 'ADMS attendance push processed');
  res.type('text/plain').send('OK');
});

module.exports = { handshake, getRequest, pushData };
