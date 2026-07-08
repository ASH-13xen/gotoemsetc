const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const userValidator = require('../validators/user.validator');
const userController = require('../controllers/user.controller');

const router = Router();

router.get('/', userController.list);
router.get(
  '/by-employee/:employeeId',
  validate(userValidator.getByEmployeeId),
  userController.getForEmployee
);
router.post(
  '/by-employee/:employeeId',
  validate(userValidator.createCredential),
  userController.createForEmployee
);
router.get('/:id', validate(userValidator.getById), userController.getById);
router.patch('/:id', validate(userValidator.updateCredential), userController.updateCredential);
router.delete('/:id', validate(userValidator.removeCredential), userController.removeCredential);

module.exports = router;
