const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const validator = require('../validators/overtimeRequest.validator');
const controller = require('../controllers/overtimeRequest.controller');

// Who may do what is decided in overtimeRequest.service.js — it depends on
// the request itself (whose team, which step), not on a fixed role.
const router = Router();

router.post('/', validate(validator.apply), controller.apply);
router.get('/pending', controller.pending);
router.get('/employee/:employeeId', validate(validator.forEmployee), controller.forEmployee);
router.post('/:id/cm-approve', validate(validator.cmApprove), controller.cmApprove);
router.post('/:id/approve', validate(validator.approve), controller.approve);
router.post('/:id/reject', validate(validator.reject), controller.reject);

module.exports = router;
