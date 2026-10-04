const { Router } = require('express');
const { requireAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
const validate = require('../middlewares/validate.middleware');
const orgChartValidator = require('../validators/orgChart.validator');
const orgChartController = require('../controllers/orgChart.controller');

// Viewing is open to everyone signed in; every change is admin-only.
const router = Router();

router.get('/', orgChartController.getTree);
router.use(requireAccess(ACCESS.ORG_CHART_EDIT));
router.post('/nodes', validate(orgChartValidator.createNode), orgChartController.createNode);
router.patch('/nodes/:id', validate(orgChartValidator.updateNode), orgChartController.updateNode);
router.post('/nodes/:id/move', validate(orgChartValidator.moveNode), orgChartController.moveNode);
router.put('/nodes/:id/assignees', validate(orgChartValidator.setAssignees), orgChartController.setAssignees);
router.delete('/nodes/:id', validate(orgChartValidator.deleteNode), orgChartController.deleteNode);

module.exports = router;
