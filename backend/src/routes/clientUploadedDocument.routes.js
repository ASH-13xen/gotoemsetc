const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middlewares/validate.middleware');
const clientDocumentRequestController = require('../controllers/clientDocumentRequest.controller');

const router = Router();
const idParam = { params: z.object({ docId: z.string().min(1) }) };

router.get('/:docId/file', validate(idParam), clientDocumentRequestController.downloadUploaded);
router.delete('/:docId', validate(idParam), clientDocumentRequestController.removeUploaded);

module.exports = router;
