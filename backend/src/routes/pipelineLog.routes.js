const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const pipelineLogValidator = require('../validators/pipelineLog.validator');
const pipelineLogController = require('../controllers/pipelineLog.controller');

const router = Router();

router.get('/', validate(pipelineLogValidator.list), pipelineLogController.list);
router.post('/', validate(pipelineLogValidator.create), pipelineLogController.create);

module.exports = router;
