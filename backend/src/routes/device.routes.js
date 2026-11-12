const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
const { can } = require('../utils/roles');
const deviceService = require('../services/device.service');
const deviceAccess = require('../services/deviceAccess.service');
const { DEVICE_STATUS } = require('../utils/deviceCatalog');

// HR Work → Devices (services/device.service.js, deviceAccess.service.js).
// Everything is HR's (admin, CEO, HR) except "mine": a holder's own devices —
// confirm a handover, send the monthly check, report a problem, log footage.
const router = Router();
const hr = requireAccess(ACCESS.HRMS);
const id = { params: z.object({ id: z.string().min(1) }) };
const audit = (req, action, resourceId, metadata) => {
  req.auditContext = { action, resourceType: 'Device', resourceId: String(resourceId), metadata };
};
// A multipart form carries its fields as JSON in `data`, beside the photos.
const formData = (req) => {
  if (!req.body?.data) return req.body || {};
  try {
    return JSON.parse(req.body.data);
  } catch {
    throw ApiError.badRequest('The form could not be read');
  }
};
const sendPdf = (res, { pdf, filename }) => {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.send(pdf);
};
const sendFile = (res, file) => {
  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename || 'file')}"`);
  res.send(file.data);
};

// ---------------------------------------------------------------- the holder's own

router.get('/mine', asyncHandler(async (req, res) => res.json(await deviceService.mine(req.user))));
router.post(
  '/mine/assignments/:id/accept',
  validate(id),
  asyncHandler(async (req, res) => {
    const assignment = await deviceService.accept(req.params.id, req.user);
    audit(req, 'device.accept', assignment.device);
    res.json({ assignment });
  })
);
router.post(
  '/mine/:id/check',
  upload.array('photos', 8),
  validate(id),
  asyncHandler(async (req, res) => {
    const check = await deviceService.holderCheck(req.params.id, formData(req), req.user, req.files || []);
    audit(req, 'device.monthlyCheck', req.params.id);
    res.status(201).json({ check });
  })
);
router.post(
  '/mine/:id/issues',
  validate(id),
  asyncHandler(async (req, res) => {
    const issue = await deviceService.reportIssue(req.params.id, req.body, req.user, { byHolder: true });
    audit(req, 'device.reportIssue', req.params.id, { category: req.body.category });
    res.status(201).json({ issue });
  })
);
router.post(
  '/mine/footage',
  asyncHandler(async (req, res) => {
    const upload_ = await deviceService.logFootage(req.body, req.user, { byHolder: true });
    res.status(201).json({ upload: upload_ });
  })
);

// Files: the brand kit for anyone; check photos for their holder; the rest for HR.
router.get(
  '/files/:id',
  validate(id),
  asyncHandler(async (req, res) => sendFile(res, await deviceService.getFile(req.params.id, req.user, { hr: can(req.user, ACCESS.HRMS) })))
);

// ---------------------------------------------------------------- HR

router.get('/summary', hr, asyncHandler(async (req, res) => res.json(await deviceService.summary())));
router.get('/action-items', hr, asyncHandler(async (req, res) => res.json(await deviceService.actionItems())));

router.get('/settings', hr, asyncHandler(async (req, res) => res.json({ settings: await deviceService.getSettings() })));
router.put(
  '/settings',
  hr,
  asyncHandler(async (req, res) => {
    const settings = await deviceAccess.updateSettings(req.body);
    audit(req, 'device.settings', 'settings');
    res.json({ settings });
  })
);
router.post(
  '/settings/brand/:which',
  hr,
  upload.single('file'),
  asyncHandler(async (req, res) => res.json({ settings: await deviceAccess.setBrandFile(req.params.which, req.file, req.user) }))
);

router.get('/accessories', hr, asyncHandler(async (req, res) => res.json({ accessories: await deviceService.accessoryStock() })));
router.post('/accessories', hr, asyncHandler(async (req, res) => res.status(201).json({ accessory: await deviceService.createAccessory(req.body) })));
router.patch('/accessories/:id', hr, validate(id), asyncHandler(async (req, res) => res.json({ accessory: await deviceService.updateAccessory(req.params.id, req.body) })));

router.get('/accounts', hr, asyncHandler(async (req, res) => res.json({ accounts: await deviceAccess.listAccounts(req.query) })));
router.post(
  '/accounts',
  hr,
  asyncHandler(async (req, res) => {
    const account = await deviceAccess.createAccount(req.body, req.user);
    audit(req, 'deviceAccount.create', account._id, { kind: account.kind, identifier: account.identifier });
    res.status(201).json({ account: { _id: account._id } });
  })
);
router.patch(
  '/accounts/:id',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    await deviceAccess.updateAccount(req.params.id, req.body, req.user);
    audit(req, 'deviceAccount.update', req.params.id, { passwordChanged: Boolean(req.body.password) });
    res.json({ ok: true });
  })
);
router.delete(
  '/accounts/:id',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    audit(req, 'deviceAccount.delete', req.params.id);
    res.json(await deviceAccess.deleteAccount(req.params.id));
  })
);
// Every reveal of a password is in the audit log.
router.post(
  '/accounts/:id/reveal',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    const secrets = await deviceAccess.revealAccount(req.params.id);
    audit(req, 'deviceAccount.reveal', req.params.id);
    res.json(secrets);
  })
);

router.get('/checks', hr, asyncHandler(async (req, res) => res.json({ checks: await deviceService.listChecks(req.query) })));
router.post(
  '/checks/:id/review',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    const check = await deviceService.reviewCheck(req.params.id, req.body, req.user);
    audit(req, 'device.reviewCheck', check.device?._id || check.device, { ok: Boolean(req.body.ok) });
    res.json({ check });
  })
);

router.get('/issues', hr, asyncHandler(async (req, res) => res.json({ issues: await deviceService.listIssues(req.query) })));
router.post('/issues/:id/resolve', hr, validate(id), asyncHandler(async (req, res) => res.json({ issue: await deviceService.resolveIssue(req.params.id, req.body, req.user) })));

router.get('/footage', hr, asyncHandler(async (req, res) => res.json({ uploads: await deviceService.listFootage(req.query) })));
router.post('/footage', hr, asyncHandler(async (req, res) => res.status(201).json({ upload: await deviceService.logFootage(req.body, req.user, { byHolder: false }) })));
router.patch('/footage/:id', hr, validate(id), asyncHandler(async (req, res) => res.json({ upload: await deviceService.setFootageCleared(req.params.id, req.body.clearedFromPhone) })));

router.get('/runbooks', hr, asyncHandler(async (req, res) => res.json({ runbooks: await deviceAccess.listRunbooks(req.query) })));
router.post(
  '/runbooks/:id/steps/:stepId',
  hr,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const body = { ...req.body, done: req.body.done === undefined ? undefined : req.body.done === true || req.body.done === 'true' };
    const runbook = await deviceAccess.tickStep(req.params.id, req.params.stepId, body, req.user, req.file);
    audit(req, 'device.runbookStep', req.params.id, { step: req.params.stepId, done: body.done });
    res.json({ runbook });
  })
);

router.get('/access/:id', hr, validate(id), asyncHandler(async (req, res) => res.json(await deviceAccess.employeeAccess(req.params.id))));
router.post('/access/:id/items', hr, validate(id), asyncHandler(async (req, res) => res.json(await deviceAccess.addAccessItem(req.params.id, req.body))));
router.patch(
  '/access/:id/items/:itemId',
  hr,
  asyncHandler(async (req, res) => res.json(await deviceAccess.updateAccessItem(req.params.id, req.params.itemId, req.body, req.user)))
);
router.delete('/access/:id/items/:itemId', hr, asyncHandler(async (req, res) => res.json(await deviceAccess.removeAccessItem(req.params.id, req.params.itemId))));
router.post(
  '/access/:id/revoke',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    const runbook = await deviceAccess.startRevoke(req.params.id, req.body, req.user);
    audit(req, 'device.revokeAccess', req.params.id, { reason: req.body.reason });
    res.status(201).json({ runbook });
  })
);

const which = (req) => {
  if (!['agreement', 'receipt'].includes(req.params.which)) throw ApiError.notFound('Unknown document');
  return req.params.which;
};
router.get('/assignments/:id/:which', hr, asyncHandler(async (req, res) => sendPdf(res, await deviceService.renderDocument(req.params.id, which(req)))));
router.post(
  '/assignments/:id/signed/:which',
  hr,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const assignment = await deviceService.uploadSigned(req.params.id, which(req), req.file, req.user);
    audit(req, 'device.signedCopy', assignment.device, { which: req.params.which });
    res.json({ assignment });
  })
);
router.post('/assignments/:id/steps/:key', hr, asyncHandler(async (req, res) => res.json({ assignment: await deviceService.setStepDone(req.params.id, req.params.key, req.body.done !== false, req.user) })));
router.post(
  '/assignments/:id/waive',
  hr,
  asyncHandler(async (req, res) => {
    const assignment = await deviceService.waiveRecovery(req.params.id, req.body.note, req.user);
    audit(req, 'device.waiveRecovery', assignment.device, { note: req.body.note });
    res.json({ assignment });
  })
);

router.get('/', hr, asyncHandler(async (req, res) => res.json({ devices: await deviceService.list(req.query) })));
router.post(
  '/',
  hr,
  asyncHandler(async (req, res) => {
    const device = await deviceService.create(req.body, req.user);
    audit(req, 'device.create', device._id, { code: device.code });
    res.status(201).json({ device });
  })
);
router.get('/:id', hr, validate(id), asyncHandler(async (req, res) => res.json(await deviceService.detail(req.params.id))));
router.patch('/:id', hr, validate(id), asyncHandler(async (req, res) => res.json({ device: await deviceService.update(req.params.id, req.body) })));
router.post(
  '/:id/assign',
  hr,
  upload.array('photos', 8),
  validate(id),
  asyncHandler(async (req, res) => {
    const assignment = await deviceService.assign(req.params.id, formData(req), req.user, req.files || []);
    audit(req, 'device.assign', req.params.id, { employee: String(assignment.employee) });
    res.status(201).json({ assignment });
  })
);
router.post(
  '/:id/return',
  hr,
  upload.array('photos', 8),
  validate(id),
  asyncHandler(async (req, res) => {
    const assignment = await deviceService.returnDevice(req.params.id, formData(req), req.user, req.files || []);
    audit(req, 'device.return', req.params.id, { employee: String(assignment.employee) });
    res.json({ assignment });
  })
);
router.post(
  '/:id/lost',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    const runbook = await deviceService.markLost(req.params.id, req.body, req.user);
    audit(req, 'device.lost', req.params.id, { note: req.body.note });
    res.status(201).json({ runbook });
  })
);
router.post('/:id/found', hr, validate(id), asyncHandler(async (req, res) => res.json({ device: await deviceService.markFound(req.params.id, req.user) })));
router.post('/:id/repair', hr, validate(id), asyncHandler(async (req, res) => res.json({ device: await deviceService.setStatus(req.params.id, req.body.done ? DEVICE_STATUS.AVAILABLE : DEVICE_STATUS.REPAIR) })));
router.post(
  '/:id/retire',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    audit(req, 'device.retire', req.params.id);
    res.json({ device: await deviceService.setStatus(req.params.id, DEVICE_STATUS.RETIRED) });
  })
);
router.delete(
  '/:id',
  hr,
  validate(id),
  asyncHandler(async (req, res) => {
    const device = await deviceService.remove(req.params.id);
    audit(req, 'device.delete', req.params.id, { code: device.code });
    res.json({ deleted: true });
  })
);
router.post(
  '/:id/checks',
  hr,
  upload.array('photos', 8),
  validate(id),
  asyncHandler(async (req, res) => res.status(201).json({ check: await deviceService.hrCheck(req.params.id, formData(req), req.user, req.files || []) }))
);
router.post('/:id/issues', hr, validate(id), asyncHandler(async (req, res) => res.status(201).json({ issue: await deviceService.reportIssue(req.params.id, req.body, req.user, { byHolder: false }) })));

module.exports = router;
