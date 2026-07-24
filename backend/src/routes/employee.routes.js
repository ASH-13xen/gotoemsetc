const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const employeeValidator = require('../validators/employee.validator');
const employeeController = require('../controllers/employee.controller');
const documentGenerationValidator = require('../validators/documentGeneration.validator');
const documentController = require('../controllers/document.controller');
const uploadRequestValidator = require('../validators/uploadRequest.validator');
const uploadRequestController = require('../controllers/uploadRequest.controller');
const uploadedDocumentValidator = require('../validators/uploadedDocument.validator');
const uploadedDocumentController = require('../controllers/uploadedDocument.controller');
const attendanceValidator = require('../validators/attendance.validator');
const attendanceController = require('../controllers/attendance.controller');
const salarySlipValidator = require('../validators/salarySlip.validator');
const salarySlipController = require('../controllers/salarySlip.controller');
const upload = require('../middlewares/multer.middleware');
const {
  requireRole,
  requireSelfOrAdmin,
  requirePermission,
  requireSelfOrPermission,
  requireDirectoryAccess,
  requireSelfOrDirectoryAccess,
} = require('../middlewares/auth.middleware');
const { USER_ROLES, PERMISSIONS } = require('../config/constants');

const router = Router();

// Any granted permission unlocks directory browsing (you need to find the
// employee before you can act on them) — see requireDirectoryAccess.
router.get('/', requireDirectoryAccess(), validate(employeeValidator.list), employeeController.list);
router.post('/', requirePermission(PERMISSIONS.ADD_EMPLOYEE), validate(employeeValidator.create), employeeController.create);
// Must come before /:id — otherwise Express matches "birthdays"/
// "attendance-today" as an :id.
// Left open to any authenticated user, unlike everything else here — the
// birthdays widget is meant to stay visible platform-wide.
router.get('/birthdays', employeeController.birthdays);
router.get('/attendance-today', requirePermission(PERMISSIONS.MARK_ATTENDANCE), attendanceController.markedToday);
router.get('/:id', requireSelfOrDirectoryAccess(), validate(employeeValidator.getOrDelete), employeeController.getById);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.EDIT_EMPLOYEE_DETAILS),
  validate(employeeValidator.update),
  employeeController.update
);
// Deletion stays strictly admin-only — not part of the grantable permission set.
router.delete('/:id', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), validate(employeeValidator.getOrDelete), employeeController.remove);

// Flags (red/green performance markers) — role-only, not a grantable
// permission, per the product ask.
router.post(
  '/:id/flags',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(employeeValidator.addFlag),
  employeeController.addFlag
);
router.delete(
  '/:id/flags/:flagId',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(employeeValidator.removeFlag),
  employeeController.removeFlag
);

router.post(
  '/:id/documents/generate',
  requirePermission(PERMISSIONS.GENERATE_DOCUMENTS),
  validate(documentGenerationValidator.generate),
  documentController.generate
);
router.get(
  '/:id/documents',
  requirePermission(PERMISSIONS.GENERATE_DOCUMENTS),
  validate(documentGenerationValidator.listForEmployee),
  documentController.listForEmployee
);
router.post(
  '/:id/documents/:docId/signed',
  requirePermission(PERMISSIONS.GENERATE_DOCUMENTS),
  upload.single('file'),
  validate(documentGenerationValidator.uploadSigned),
  documentController.uploadSigned
);

router.post(
  '/:id/upload-requests',
  requirePermission(PERMISSIONS.REQUEST_DOCUMENTS),
  validate(uploadRequestValidator.create),
  uploadRequestController.create
);
router.get(
  '/:id/upload-requests',
  requirePermission(PERMISSIONS.REQUEST_DOCUMENTS),
  validate(uploadRequestValidator.listForEmployee),
  uploadRequestController.listForEmployee
);
router.get(
  '/:id/uploaded-documents',
  requirePermission(PERMISSIONS.REQUEST_DOCUMENTS),
  validate(uploadedDocumentValidator.listForEmployee),
  uploadedDocumentController.listForEmployee
);
// Admin attaching a document directly (no request link/access-code flow) —
// strictly admin-only per product ask, not part of the grantable permission
// set like the rest of the Document System.
router.post(
  '/:id/uploaded-documents',
  requireRole(USER_ROLES.ADMIN),
  upload.single('file'),
  validate(uploadedDocumentValidator.adminUpload),
  uploadedDocumentController.adminUpload
);

router.get(
  '/:id/activity',
  requireSelfOrAdmin(),
  validate(employeeValidator.getOrDelete),
  employeeController.activity
);

// Marking attendance needs mark_attendance; reading is self, admin, or
// mark_attendance (you need to see it before you can decide what to mark).
router.post(
  '/:id/attendance',
  requirePermission(PERMISSIONS.MARK_ATTENDANCE),
  validate(attendanceValidator.mark),
  attendanceController.mark
);
router.get(
  '/:id/attendance',
  requireSelfOrPermission(PERMISSIONS.MARK_ATTENDANCE),
  validate(attendanceValidator.listForEmployee),
  attendanceController.listForEmployee
);
router.get(
  '/:id/attendance/summary',
  requireSelfOrPermission(PERMISSIONS.MARK_ATTENDANCE),
  validate(attendanceValidator.getSummary),
  attendanceController.getSummary
);

router.post(
  '/:id/salary-slips/generate',
  requirePermission(PERMISSIONS.VIEW_SALARY_SLIP),
  validate(salarySlipValidator.generate),
  salarySlipController.generate
);
router.get(
  '/:id/salary-slips',
  requirePermission(PERMISSIONS.VIEW_SALARY_SLIP),
  validate(salarySlipValidator.listForEmployee),
  salarySlipController.listForEmployee
);

module.exports = router;
