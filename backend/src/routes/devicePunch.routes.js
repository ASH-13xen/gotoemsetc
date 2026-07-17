const { Router } = require('express');
const devicePunchController = require('../controllers/devicePunch.controller');
const { requireSelfOrAdmin } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', requireSelfOrAdmin('employeeId', 'query'), devicePunchController.list);

module.exports = router;
