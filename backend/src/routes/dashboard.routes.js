const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = Router();

router.get('/stats', dashboardController.getStats);
router.get('/followups', dashboardController.getFollowupsStats);

module.exports = router;
