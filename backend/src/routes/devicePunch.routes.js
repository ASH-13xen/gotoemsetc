const { Router } = require('express');
const devicePunchController = require('../controllers/devicePunch.controller');

const router = Router();

router.get('/', devicePunchController.list);

module.exports = router;
