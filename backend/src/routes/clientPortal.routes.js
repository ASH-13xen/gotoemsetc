const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireClientPortalAuth } = require('../middlewares/clientPortalAuth.middleware');
const clientPortalAuthValidator = require('../validators/clientPortalAuth.validator');
const clientPortalAuthController = require('../controllers/clientPortalAuth.controller');

const router = Router();

router.post('/login', validate(clientPortalAuthValidator.login), clientPortalAuthController.login);
router.get('/me', requireClientPortalAuth, clientPortalAuthController.me);

module.exports = router;
