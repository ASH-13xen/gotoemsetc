const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireFeature } = require('../middlewares/feature.middleware');
const clientWork = require('../services/clientWork.service');
const workLog = require('../services/workLog.service');
const clientValue = require('../services/clientValue.service');
const shoots = require('../services/shootSession.service');

// Client work (services/clientWork.service.js), the work timer
// (workLog.service.js) and the client value report (clientValue.service.js).
// Who may do what is decided in the services. Off with Task Management.
const router = Router();
router.use(requireFeature('TASK_MANAGEMENT'));

const audit = (req, action, resourceId, metadata) => {
  req.auditContext = { action, resourceType: 'ClientWork', resourceId: String(resourceId), metadata };
};

// ---- clients and their months
router.get('/cards', asyncHandler(async (req, res) => res.json(await clientWork.cards(req.user, req.query))));
router.post(
  '/clients',
  asyncHandler(async (req, res) => {
    const out = await clientWork.addClient(req.user, req.body);
    audit(req, out.restored ? 'clientWork.restoreClient' : 'clientWork.addClient', out.client._id, { name: out.client.name });
    res.status(201).json(out);
  })
);
router.get('/clients/:id/months/:month', asyncHandler(async (req, res) => res.json(await clientWork.detail(req.user, req.params.id, req.params.month))));
router.put(
  '/clients/:id/months/:month',
  asyncHandler(async (req, res) => {
    const out = await clientWork.saveMonth(req.user, req.params.id, req.params.month, req.body);
    audit(req, 'clientWork.saveMonth', req.params.id, { month: req.params.month, counts: req.body.counts, result: out.result });
    res.json(out);
  })
);
router.post(
  '/clients/:id/months/:month/generate',
  asyncHandler(async (req, res) => {
    const out = await clientWork.generate(req.user, req.params.id, req.params.month);
    audit(req, 'clientWork.generate', req.params.id, { month: req.params.month, result: out.result });
    res.json(out);
  })
);
router.patch('/clients/:id/paused', asyncHandler(async (req, res) => res.json(await clientWork.setPaused(req.user, req.params.id, req.body.paused))));

// ---- the work timer
router.get('/time/current', asyncHandler(async (req, res) => res.json(await workLog.current(req.user))));
router.post('/time/start', asyncHandler(async (req, res) => res.json(await workLog.start(req.user, req.body))));
router.post('/time/stop', asyncHandler(async (req, res) => res.json(await workLog.stop(req.user))));
router.get('/time/day', asyncHandler(async (req, res) => res.json(await workLog.day(req.user, req.query))));
router.get('/time/team', asyncHandler(async (req, res) => res.json(await workLog.team(req.user, req.query))));
router.get('/time/tickets/:id', asyncHandler(async (req, res) => res.json(await workLog.forTicket(req.user, req.params.id))));
router.post(
  '/time/entries',
  asyncHandler(async (req, res) => {
    const entry = await workLog.add(req.user, req.body);
    audit(req, 'workLog.add', entry._id, { employee: req.body.employee, note: req.body.note });
    res.status(201).json({ entry });
  })
);
router.patch(
  '/time/entries/:id',
  asyncHandler(async (req, res) => {
    const entry = await workLog.edit(req.user, req.params.id, req.body);
    audit(req, 'workLog.edit', req.params.id, { reason: req.body.reason });
    res.json({ entry });
  })
);
router.delete(
  '/time/entries/:id',
  asyncHandler(async (req, res) => {
    const out = await workLog.remove(req.user, req.params.id, req.body || {});
    audit(req, 'workLog.remove', req.params.id, { reason: req.body?.reason });
    res.json(out);
  })
);

// ---- shoots
router.get('/shoots', asyncHandler(async (req, res) => res.json({ shoots: await shoots.list(req.user, req.query) })));
router.post(
  '/shoots',
  asyncHandler(async (req, res) => {
    const shoot = await shoots.create(req.user, req.body);
    audit(req, 'shoot.create', shoot._id, { day: shoot.day, reels: shoot.reels.length });
    res.status(201).json({ shoot });
  })
);
router.get('/shoots/:id', asyncHandler(async (req, res) => res.json({ shoot: await shoots.get(req.user, req.params.id) })));
router.post(
  '/shoots/:id/complete',
  asyncHandler(async (req, res) => {
    const shoot = await shoots.complete(req.user, req.params.id, req.body);
    audit(req, 'shoot.complete', req.params.id, { hours: req.body.hours });
    res.json({ shoot });
  })
);
router.post(
  '/shoots/:id/cancel',
  asyncHandler(async (req, res) => {
    const shoot = await shoots.cancel(req.user, req.params.id, req.body);
    audit(req, 'shoot.cancel', req.params.id, { reason: req.body.reason });
    res.json({ shoot });
  })
);

// ---- the client value report (CEO/admin)
router.get('/value', asyncHandler(async (req, res) => res.json(await clientValue.report(req.user, req.query))));
router.put('/value/settings', asyncHandler(async (req, res) => res.json(await clientValue.setTarget(req.user, req.body.targetMarginPct))));
router.post(
  '/value/:month/close',
  asyncHandler(async (req, res) => {
    const out = await clientValue.close(req.user, req.params.month);
    audit(req, 'clientValue.close', req.params.month);
    res.json(out);
  })
);
router.delete(
  '/value/:month/close',
  asyncHandler(async (req, res) => {
    const out = await clientValue.reopen(req.user, req.params.month);
    audit(req, 'clientValue.reopen', req.params.month);
    res.json(out);
  })
);

module.exports = router;
