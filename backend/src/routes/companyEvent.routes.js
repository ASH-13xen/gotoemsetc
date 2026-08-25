const { Router } = require('express');
const ApiError = require('../utils/ApiError');
const validate = require('../middlewares/validate.middleware');
const { isAdminLike } = require('../utils/roles');
const cmsAccess = require('../utils/cmsAccess');
const companyEventRepository = require('../repositories/companyEvent.repository');
const companyEventValidator = require('../validators/companyEvent.validator');
const companyEventController = require('../controllers/companyEvent.controller');

const router = Router();

// Company-wide events (the HR calendar) stay admin/HR-only, same as always.
// A client-scoped event (body.client on create, or the loaded event's
// .client on delete) additionally allows Digital Admin/CMS-admin access —
// Team Main et al. shouldn't need HR to log a client's birthday.
function requireCompanyEventWrite() {
  return async (req, res, next) => {
    try {
      if (!req.user) return next(ApiError.unauthorized());
      if (isAdminLike(req.user)) return next();

      let clientId = req.body?.client || null;
      if (!clientId && req.params?.id) {
        const event = await companyEventRepository.findById(req.params.id);
        clientId = event?.client || null;
      }
      if (clientId && cmsAccess.isCmsAdmin(req.user)) return next();
      return next(ApiError.forbidden("You don't have permission to manage this event."));
    } catch (err) {
      next(err);
    }
  };
}

// Open to any logged-in user — the company calendar needs this for
// everyone, not just admins/HR (same convention as holidays).
router.get('/', validate(companyEventValidator.list), companyEventController.list);
router.get('/client/:clientId', companyEventController.listForClient);
router.post('/', requireCompanyEventWrite(), validate(companyEventValidator.create), companyEventController.create);
router.delete(
  '/:id',
  requireCompanyEventWrite(),
  validate(companyEventValidator.remove),
  companyEventController.remove
);

module.exports = router;
