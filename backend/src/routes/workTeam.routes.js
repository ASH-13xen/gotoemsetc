const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireTeamManagementAccess } = require('../middlewares/auth.middleware');
const workTeamValidator = require('../validators/workTeam.validator');
const workTeamController = require('../controllers/workTeam.controller');

const router = Router();

// Open to any logged-in employee — Task Management needs every employee to
// see team rosters (pickers, who leads what), even though only admin/HR, a
// manage_tasks holder, or the global Team Leader can create/edit/delete teams.
router.get('/', workTeamController.list);
router.get('/:id', validate(workTeamValidator.getOrDelete), workTeamController.get);
router.post('/', requireTeamManagementAccess(), validate(workTeamValidator.create), workTeamController.create);
router.patch(
  '/:id',
  requireTeamManagementAccess(),
  validate(workTeamValidator.update),
  workTeamController.update
);
router.delete(
  '/:id',
  requireTeamManagementAccess(),
  validate(workTeamValidator.getOrDelete),
  workTeamController.remove
);

module.exports = router;
