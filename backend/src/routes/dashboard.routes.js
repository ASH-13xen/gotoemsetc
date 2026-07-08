const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = Router();

router.get('/stats', dashboardController.getStats);

module.exports = router;
