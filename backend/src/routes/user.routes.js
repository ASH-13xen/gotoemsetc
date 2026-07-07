const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const userValidator = require('../validators/user.validator');
const userController = require('../controllers/user.controller');

const router = Router();

router.get('/', userController.list);
router.get('/:id', validate(userValidator.getById), userController.getById);

module.exports = router;
