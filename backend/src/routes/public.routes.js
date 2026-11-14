const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { publicUploadLimiter } = require('../middlewares/rateLimiter.middleware');
const uploadRequestValidator = require('../validators/uploadRequest.validator');
const publicUploadController = require('../controllers/publicUpload.controller');
const googleFormWebhookController = require('../controllers/googleFormWebhook.controller');
const weeklyCalendarValidator = require('../validators/weeklyCalendar.validator');
const weeklyCalendarController = require('../controllers/weeklyCalendar.controller');

const router = Router();

router.use(publicUploadLimiter);

// Resumes travel as base64 in this JSON body — the app-wide express.json()
// limit in app.js is raised to accommodate this one path (see there for why
// it can't just be scoped here: the global parser already consumes the
// request stream before this router runs).
router.post('/applicants/google-form', googleFormWebhookController.submit);

// Weekly Calendar invite emails — Accept/Decline without logging in. The
// signed token in the link says exactly which invite and which person.
router.get('/calendar-invites/:token', validate(weeklyCalendarValidator.publicToken), weeklyCalendarController.publicInvite);
router.post('/calendar-invites/:token', validate(weeklyCalendarValidator.publicRespond), weeklyCalendarController.publicRespond);

router.post(
  '/upload-requests/:token/verify',
  validate(uploadRequestValidator.verifyCode),
  publicUploadController.verifyAccessCode
);
router.get(
  '/upload-requests/:token',
  validate(uploadRequestValidator.getPublicStatus),
  publicUploadController.getStatus
);
router.post(
  '/upload-requests/:token/documents',
  // multer must run first — it's what parses the multipart body, so the
  // `code` text field validate() checks isn't populated on req.body yet
  // until upload.any() has run.
  upload.any(),
  validate(uploadRequestValidator.uploadDocuments),
  publicUploadController.uploadDocuments
);

// E-signing (services/esign.service.js): the employee's link from the email
// (a code emailed to the same address opens it), and the public check of any
// signed or issued copy.
{
  const { z } = require('zod');
  const esign = require('../services/esign.service');
  const asyncHandler = require('../utils/asyncHandler');
  const meta = (req) => ({ ip: req.ip, agent: String(req.get('user-agent') || '').slice(0, 300) });
  const token = { params: z.object({ token: z.string().min(16).max(200) }) };
  const session = (req) => String(req.get('x-esign-session') || req.body?.session || '');
  router.get('/esign/:token', validate(token), asyncHandler(async (req, res) => res.json(await esign.view(req.params.token, meta(req)))));
  router.post('/esign/:token/code', validate(token), asyncHandler(async (req, res) => res.json(await esign.sendCode(req.params.token, meta(req)))));
  router.post(
    '/esign/:token/verify',
    validate({ ...token, body: z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') }) }),
    asyncHandler(async (req, res) => res.json(await esign.verifyCode(req.params.token, req.body.code, meta(req))))
  );
  router.get(
    '/esign/:token/file',
    validate(token),
    asyncHandler(async (req, res) => {
      const { pdf, filename } = await esign.publicFile(req.params.token, session(req));
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${filename}"`);
      res.set('Cache-Control', 'no-store');
      res.send(pdf);
    })
  );
  router.post(
    '/esign/:token/sign',
    validate({ ...token, body: z.object({ session: z.string().min(16), name: z.string().trim().min(1).max(120), signature: z.string().max(700000), consent: z.boolean() }) }),
    asyncHandler(async (req, res) => res.json(await esign.sign(req.params.token, req.body, meta(req))))
  );
  router.post(
    '/esign/:token/decline',
    validate({ ...token, body: z.object({ session: z.string().min(16), reason: z.string().trim().min(1).max(1000) }) }),
    asyncHandler(async (req, res) => res.json(await esign.decline(req.params.token, req.body, meta(req))))
  );
  router.get(
    '/verify/:code',
    validate({ params: z.object({ code: z.string().trim().min(6).max(30) }) }),
    asyncHandler(async (req, res) => res.json(await esign.verifyByCode(req.params.code)))
  );
  router.post(
    '/verify',
    upload.single('file'),
    asyncHandler(async (req, res) => res.json(await esign.verifyUpload(req.file?.buffer)))
  );
}

// The public /quotations/:token and /client-documents/:token routes that used
// to live here were removed with the old sales CMS — any share link already
// issued for them is dead by design.

module.exports = router;
