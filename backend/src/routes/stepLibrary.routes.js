const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const stepLibraryValidator = require('../validators/stepLibrary.validator');
const stepLibraryController = require('../controllers/stepLibrary.controller');

const router = Router();

router.get('/', stepLibraryController.list);
router.post('/', validate(stepLibraryValidator.create), stepLibraryController.create);
router.patch('/:id', validate(stepLibraryValidator.update), stepLibraryController.update);
router.delete('/:id', validate(stepLibraryValidator.remove), stepLibraryController.remove);

module.exports = router;
