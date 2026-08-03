const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requirePermission } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const workTeamValidator = require('../validators/workTeam.validator');
const workTeamController = require('../controllers/workTeam.controller');

const router = Router();

// Open to any logged-in employee — Task Management needs every employee to
// see team rosters (pickers, who leads what), even though only admin/HR or a
// manage_tasks holder can create/edit/delete teams.
router.get('/', workTeamController.list);
router.get('/:id', validate(workTeamValidator.getOrDelete), workTeamController.get);
router.post(
  '/',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(workTeamValidator.create),
  workTeamController.create
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(workTeamValidator.update),
  workTeamController.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(workTeamValidator.getOrDelete),
  workTeamController.remove
);

module.exports = router;
