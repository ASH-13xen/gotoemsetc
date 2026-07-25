const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const uploadedDocumentValidator = require('../validators/uploadedDocument.validator');
const uploadedDocumentController = require('../controllers/uploadedDocument.controller');

const router = Router();

router.get('/:id/file', validate(uploadedDocumentValidator.remove), uploadedDocumentController.downloadFile);
router.delete('/:id', validate(uploadedDocumentValidator.remove), uploadedDocumentController.remove);

module.exports = router;
