const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const quotationValidator = require('../validators/quotation.validator');
const quotationController = require('../controllers/quotation.controller');

const router = Router();

router.post('/:id/admin-sign', validate(quotationValidator.adminSign), quotationController.adminSign);
router.post('/:id/share-link', validate(quotationValidator.getOrShareLink), quotationController.shareLink);
router.get('/:id/file/:variant', validate(quotationValidator.getFile), quotationController.downloadFile);

module.exports = router;
