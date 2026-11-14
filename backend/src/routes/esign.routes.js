const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { requireAccess, requirePermission } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
const { PERMISSIONS } = require('../config/constants');
const esign = require('../services/esign.service');

// E-signing generated documents (services/esign.service.js) — the signed-in
// side: HR sending, the company's signatories, and the employee's own
// documents. The employee's signing page itself is public (public.routes.js).
const router = Router();
const docs = requirePermission(PERMISSIONS.GENERATE_DOCUMENTS);
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const idParam = { params: z.object({ id: objectId }) };
const meta = (req) => ({ ip: req.ip, agent: String(req.get('user-agent') || '').slice(0, 300) });
const audit = (req, action, resourceId, metadata) => {
  req.auditContext = { action, resourceType: 'DocumentSignature', resourceId: String(resourceId), metadata };
};
const sendPdf = (res, { pdf, filename }) => {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdf);
};

// ---- the company's signatories (admin, CEO, HR)
router.get('/settings', requireAccess(ACCESS.EMS_ALL), asyncHandler(async (req, res) => res.json(await esign.getSettings())));
router.put(
  '/signatories/:key',
  requireAccess(ACCESS.EMS_ALL),
  upload.single('image'),
  validate({ params: z.object({ key: z.enum(['ceo', 'hr']) }), body: z.object({ name: z.string().trim().min(1).max(120), title: z.string().trim().max(120).optional() }) }),
  asyncHandler(async (req, res) => {
    const out = await esign.setSignatory(req.user, req.params.key, req.body, req.file);
    audit(req, 'esign.setSignatory', req.params.key, { name: req.body.name, image: Boolean(req.file) });
    res.json(out);
  })
);

// ---- HR: sending, reminding, withdrawing
router.post(
  '/send',
  docs,
  validate({ body: z.object({ employeeId: objectId, documentId: objectId, channel: z.enum(['company', 'personal']).default('company') }) }),
  asyncHandler(async (req, res) => {
    const out = await esign.send(req.user, req.body.employeeId, req.body.documentId, { channel: req.body.channel }, meta(req));
    audit(req, 'esign.send', out._id, { document: req.body.documentId, channel: req.body.channel, kind: out.kind });
    res.status(201).json({ signature: out });
  })
);
router.post(
  '/:id/remind',
  docs,
  validate(idParam),
  asyncHandler(async (req, res) => {
    const out = await esign.remind(req.user, req.params.id);
    audit(req, 'esign.remind', req.params.id);
    res.json({ signature: out });
  })
);
router.post(
  '/:id/cancel',
  docs,
  validate({ ...idParam, body: z.object({ reason: z.string().trim().max(500).optional() }).optional() }),
  asyncHandler(async (req, res) => {
    const out = await esign.cancel(req.user, req.params.id, req.body || {});
    audit(req, 'esign.cancel', req.params.id, { reason: req.body?.reason });
    res.json({ signature: out });
  })
);

// ---- listing and files (HR for anyone; an employee for their own)
router.get('/employee/:id', validate(idParam), asyncHandler(async (req, res) => res.json({ signatures: await esign.listForEmployee(req.user, req.params.id) })));
router.get('/:id/file', validate(idParam), asyncHandler(async (req, res) => sendPdf(res, await esign.fileFor(req.user, req.params.id))));
// The employee opening one from EMS: a short-lived signing link.
router.post('/:id/open', validate(idParam), asyncHandler(async (req, res) => res.json(await esign.openMine(req.user, req.params.id))));

module.exports = router;
