const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireOperationsAccess } = require('../middlewares/auth.middleware');
const keyHolderValidator = require('../validators/keyHolder.validator');
const keyHolderController = require('../controllers/keyHolder.controller');

const router = Router();

// Open to any authenticated employee — everyone can see who holds which
// key. Only reassigning one is Operations-only.
router.get('/', keyHolderController.list);
router.post(
  '/:key/assign',
  requireOperationsAccess(),
  validate(keyHolderValidator.assign),
  keyHolderController.assign
);

module.exports = router;
