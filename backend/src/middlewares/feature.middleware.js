const ApiError = require('../utils/ApiError');
const { FEATURES } = require('../config/constants');

// Refuses every request to a section that is switched off (constants.js
// FEATURES), so hiding a section in the apps also closes its API.
function requireFeature(feature) {
  return (req, res, next) => {
    if (!FEATURES[feature]) return next(ApiError.notFound('This section is switched off'));
    return next();
  };
}

module.exports = { requireFeature };
