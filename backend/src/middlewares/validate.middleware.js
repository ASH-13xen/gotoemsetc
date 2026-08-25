const ApiError = require('../utils/ApiError');

// schemas: { body?: ZodSchema, params?: ZodSchema, query?: ZodSchema }
function validate(schemas) {
  return (req, res, next) => {
    for (const key of ['body', 'params', 'query']) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        // A flat "dotted.path" -> message map, one entry per failing field —
        // including nested ones (e.g. "permanentAddress.pincode"), unlike
        // Zod's own flatten() which only buckets by the top-level key. Same
        // shape error.middleware.js already produces for a Mongoose
        // ValidationError, so every frontend error-message extractor only
        // ever has one shape to handle.
        const details = Object.fromEntries(
          result.error.issues.map((issue) => [issue.path.join('.') || key, issue.message])
        );
        return next(ApiError.badRequest(`Invalid ${key}`, details));
      }
      // Express 5's req.query is a live getter that re-parses the URL on every
      // access, so a plain `req.query = result.data` silently no-ops. Replace
      // the accessor itself with a plain writable property to make it stick.
      Object.defineProperty(req, key, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}

module.exports = validate;
