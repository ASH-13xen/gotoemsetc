const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const documentGenerationValidator = require('../validators/documentGeneration.validator');
const documentController = require('../controllers/document.controller');

const router = Router();

router.get('/:id', validate(documentGenerationValidator.getOrDelete), documentController.getById);
router.get('/:id/file', validate(documentGenerationValidator.getOrDelete), documentController.downloadPdf);
router.delete('/:id', validate(documentGenerationValidator.getOrDelete), documentController.remove);

module.exports = router;
