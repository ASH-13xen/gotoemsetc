const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const uploadRequestValidator = require('../validators/uploadRequest.validator');
const uploadRequestController = require('../controllers/uploadRequest.controller');

const router = Router();

// Global, cross-employee list — backs the Dashboard's "Pending document
// requests" stat click-through in frontendems.
router.get('/', uploadRequestController.listPending);
router.post('/:id/revoke', validate(uploadRequestValidator.revoke), uploadRequestController.revoke);

module.exports = router;
