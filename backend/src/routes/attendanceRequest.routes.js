const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requirePermission } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const attendanceRequestValidator = require('../validators/attendanceRequest.validator');
const attendanceRequestController = require('../controllers/attendanceRequest.controller');

const router = Router();

router.post('/', validate(attendanceRequestValidator.create), attendanceRequestController.create);
router.get('/', validate(attendanceRequestValidator.list), attendanceRequestController.list);
router.post(
  '/:id/resolve',
  requirePermission(PERMISSIONS.MARK_ATTENDANCE),
  validate(attendanceRequestValidator.resolve),
  attendanceRequestController.resolve
);

module.exports = router;
