const { Router } = require('express');
const ApiError = require('../utils/ApiError');
const validate = require('../middlewares/validate.middleware');
const { requireAttendanceApprovalAccess } = require('../middlewares/auth.middleware');
const { isAdminLike } = require('../utils/roles');
const { USER_ROLES, PERMISSIONS, ATTENDANCE_REQUEST_STATUS, ATTENDANCE_REQUEST_APPROVAL_STAGE } = require('../config/constants');
const attendanceRequestRepository = require('../repositories/attendanceRequest.repository');
const attendanceRequestService = require('../services/attendanceRequest.service');
const attendanceRequestValidator = require('../validators/attendanceRequest.validator');
const attendanceRequestController = require('../controllers/attendanceRequest.controller');

const router = Router();

// The existing HR/admin/ceo/mark_attendance tier is always allowed, same as
// requireAttendanceApprovalAccess — but a request still sitting at the
// Content Manager stage additionally lets that specific stage's eligible
// Content Manager(s) through, for cm-approve and reject only (never
// resolve/revoke, which stay HR-tier-only — a CM never touches
// AttendanceRecord directly). Data-aware, so it's a local async middleware
// rather than a flat role check — same shape as
// companyEvent.routes.js#requireCompanyEventWrite.
function requireCmOrHrApprovalAccess() {
  return async (req, res, next) => {
    try {
      if (!req.user) return next(ApiError.unauthorized());
      if (
        isAdminLike(req.user) ||
        req.user.role === USER_ROLES.CEO ||
        req.user.permissions.includes(PERMISSIONS.MARK_ATTENDANCE)
      ) {
        return next();
      }

      const request = await attendanceRequestRepository.findById(req.params.id);
      if (!request) return next(); // let the controller's own 404 fire
      if (
        request.status !== ATTENDANCE_REQUEST_STATUS.PENDING ||
        request.approvalStage !== ATTENDANCE_REQUEST_APPROVAL_STAGE.CONTENT_MANAGER
      ) {
        return next(ApiError.forbidden());
      }
      const eligible = await attendanceRequestService.isEligibleContentManagerFor(
        request.employee,
        req.user.employeeLink
      );
      return eligible ? next() : next(ApiError.forbidden());
    } catch (err) {
      next(err);
    }
  };
}

// Self-scoped — must come before the generic '/' GET below only in the
// sense of being registered at all; no path ambiguity since these never
// match '/'.
router.get('/mine/unseen', attendanceRequestController.mineUnseen);
router.get('/mine/pending-cm-review', attendanceRequestController.pendingForContentManager);
router.get(
  '/paid-leave-eligibility',
  validate(attendanceRequestValidator.paidLeaveEligibility),
  attendanceRequestController.paidLeaveEligibility
);

router.post('/', validate(attendanceRequestValidator.create), attendanceRequestController.create);
router.get('/', validate(attendanceRequestValidator.list), attendanceRequestController.list);
router.post(
  '/:id/cm-approve',
  requireCmOrHrApprovalAccess(),
  validate(attendanceRequestValidator.cmApprove),
  attendanceRequestController.cmApprove
);
router.post(
  '/:id/resolve',
  requireAttendanceApprovalAccess(),
  validate(attendanceRequestValidator.resolve),
  attendanceRequestController.resolve
);
router.post(
  '/:id/reject',
  requireCmOrHrApprovalAccess(),
  validate(attendanceRequestValidator.reject),
  attendanceRequestController.reject
);
router.post(
  '/:id/revoke',
  requireAttendanceApprovalAccess(),
  validate(attendanceRequestValidator.revoke),
  attendanceRequestController.revoke
);
router.post(
  '/:id/acknowledge',
  validate(attendanceRequestValidator.acknowledge),
  attendanceRequestController.acknowledge
);

module.exports = router;
