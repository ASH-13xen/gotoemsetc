const multer = require('multer');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error({ err }, err.message);
    return res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
  }

  // Multer's own errors (file too large, unexpected field) and the fileFilter
  // rejection below are plain Errors, not ApiError — treat both as 400s
  // rather than letting them fall through to a generic 500.
  if (err instanceof multer.MulterError || /^Unsupported file type/.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }

  // A malformed :id route param (not a valid ObjectId) reaches Mongoose as a
  // CastError — that's a client mistake, not a server fault, so it's a 400.
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid id: ${err.value}` });
  }

  // A unique-index violation (e.g. duplicate Team name, User username) is a
  // client mistake, not a server fault, so it's a 409 rather than a 500.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({ message: field ? `${field} already exists` : 'Duplicate value' });
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = errorHandler;
