const fs = require('node:fs/promises');
const ApiError = require('../utils/ApiError');
const SalarySlip = require('../models/SalarySlip');
const localFileStorage = require('./localFileStorage.service');

// A salary slip's PDF. Kept in the database: the server's own disk is wiped
// on every deploy, which lost the PDFs of slips made before this. Older slips
// are still looked for on disk; one found nowhere has to be generated again.
const NAMESPACE = 'salary-slips';

async function read(slipOrId) {
  const slip = await SalarySlip.findById(slipOrId?._id || slipOrId).select('+pdfData generatedFile');
  if (!slip) throw ApiError.notFound('Salary slip not found');
  if (slip.pdfData?.length) return slip.pdfData;
  if (slip.generatedFile?.filePath) {
    const onDisk = await fs.readFile(localFileStorage.absolutePathFor(slip.generatedFile.filePath, NAMESPACE)).catch(() => null);
    if (onDisk) return onDisk;
  }
  throw ApiError.notFound("This salary slip's PDF is no longer on file — generate the slip again");
}

// Opens it in the browser.
function send(res, data, filename) {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.send(data);
}

module.exports = { read, send };
