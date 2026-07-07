const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const getStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getStats();
  res.json(stats);
});

const getFollowupsStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getFollowupsStats();
  res.json(stats);
});

module.exports = { getStats, getFollowupsStats };
