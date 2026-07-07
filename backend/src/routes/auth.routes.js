const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { verifyToken } = require('../middlewares/auth.middleware');
const authValidator = require('../validators/auth.validator');
const authController = require('../controllers/auth.controller');

const router = Router();

router.post('/login', validate(authValidator.login), authController.login);
router.get('/me', verifyToken, authController.me);

module.exports = router;
