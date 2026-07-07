const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const quotationTemplateValidator = require('../validators/quotationTemplate.validator');
const quotationTemplateController = require('../controllers/quotationTemplate.controller');

const router = Router();

router.get('/', quotationTemplateController.list);
router.get('/:id', validate(quotationTemplateValidator.getOrPdf), quotationTemplateController.getById);
router.get('/:id/pdf', validate(quotationTemplateValidator.getOrPdf), quotationTemplateController.getPdf);
router.patch(
  '/:id/fields',
  validate(quotationTemplateValidator.updateFields),
  quotationTemplateController.updateFields
);

module.exports = router;
