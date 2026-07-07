const multer = require('multer');
const { MAX_UPLOAD_FILE_SIZE_BYTES, ALLOWED_RESUME_MIME_TYPES } = require('../config/constants');

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_RESUME_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

module.exports = resumeUpload;
