const { Router } = require('express');
const devicePunchController = require('../controllers/devicePunch.controller');
const { requireSelfOrPermission } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');

const router = Router();

router.get(
  '/',
  requireSelfOrPermission(PERMISSIONS.MARK_ATTENDANCE, 'employeeId', 'query'),
  devicePunchController.list
);

module.exports = router;
