const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const clientDocumentRequestValidator = require('../validators/clientDocumentRequest.validator');
const clientDocumentRequestController = require('../controllers/clientDocumentRequest.controller');

const router = Router();

router.post('/:id/revoke', validate(clientDocumentRequestValidator.revoke), clientDocumentRequestController.revoke);

module.exports = router;
