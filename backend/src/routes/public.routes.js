const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { publicUploadLimiter } = require('../middlewares/rateLimiter.middleware');
const uploadRequestValidator = require('../validators/uploadRequest.validator');
const publicUploadController = require('../controllers/publicUpload.controller');
const quotationValidator = require('../validators/quotation.validator');
const quotationController = require('../controllers/quotation.controller');
const googleFormWebhookController = require('../controllers/googleFormWebhook.controller');

const router = Router();

router.use(publicUploadLimiter);

// Resumes travel as base64 in this JSON body — the app-wide express.json()
// limit in app.js is raised to accommodate this one path (see there for why
// it can't just be scoped here: the global parser already consumes the
// request stream before this router runs).
router.post('/applicants/google-form', googleFormWebhookController.submit);

router.get(
  '/upload-requests/:token',
  validate(uploadRequestValidator.getPublicStatus),
  publicUploadController.getStatus
);
router.post(
  '/upload-requests/:token/documents',
  validate(uploadRequestValidator.uploadDocuments),
  upload.any(),
  publicUploadController.uploadDocuments
);

router.get('/quotations/:token', validate(quotationValidator.getPublic), quotationController.getPublic);
router.get('/quotations/:token/file', validate(quotationValidator.getPublic), quotationController.getPublicFile);
router.post('/quotations/:token/sign', validate(quotationValidator.signPublic), quotationController.signPublic);

module.exports = router;
