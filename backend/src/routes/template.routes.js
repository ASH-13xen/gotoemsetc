const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const templateValidator = require('../validators/template.validator');
const templateController = require('../controllers/template.controller');

const router = Router();

router.get('/', validate(templateValidator.list), templateController.list);
router.get('/:id', validate(templateValidator.getById), templateController.getById);

module.exports = router;
