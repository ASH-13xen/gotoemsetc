const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const auditLogValidator = require('../validators/auditLog.validator');
const auditLogController = require('../controllers/auditLog.controller');

const router = Router();

router.get('/', validate(auditLogValidator.list), auditLogController.list);

module.exports = router;
