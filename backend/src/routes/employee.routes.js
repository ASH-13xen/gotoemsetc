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
const { requireRole, requireSelfOrAdmin } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');

const router = Router();

// Browsing/creating/editing/removing employees, and the two general HR
// utility lists below, are admin-only — a worker only ever reaches their
// own record via requireSelfOrAdmin on /:id.
router.get('/', requireRole(USER_ROLES.ADMIN), validate(employeeValidator.list), employeeController.list);
router.post('/', requireRole(USER_ROLES.ADMIN), validate(employeeValidator.create), employeeController.create);
// Must come before /:id — otherwise Express matches "birthdays"/
// "attendance-today" as an :id.
router.get('/birthdays', requireRole(USER_ROLES.ADMIN), employeeController.birthdays);
router.get('/attendance-today', requireRole(USER_ROLES.ADMIN), attendanceController.markedToday);
router.get('/:id', requireSelfOrAdmin(), validate(employeeValidator.getOrDelete), employeeController.getById);
router.patch('/:id', requireRole(USER_ROLES.ADMIN), validate(employeeValidator.update), employeeController.update);
router.delete('/:id', requireRole(USER_ROLES.ADMIN), validate(employeeValidator.getOrDelete), employeeController.remove);

// Document System (Generate Docs / HR Collection) — fully admin-only.
router.post(
  '/:id/documents/generate',
  requireRole(USER_ROLES.ADMIN),
  validate(documentGenerationValidator.generate),
  documentController.generate
);
router.get(
  '/:id/documents',
  requireRole(USER_ROLES.ADMIN),
  validate(documentGenerationValidator.listForEmployee),
  documentController.listForEmployee
);

router.post(
  '/:id/upload-requests',
  requireRole(USER_ROLES.ADMIN),
  validate(uploadRequestValidator.create),
  uploadRequestController.create
);
router.get(
  '/:id/upload-requests',
  requireRole(USER_ROLES.ADMIN),
  validate(uploadRequestValidator.listForEmployee),
  uploadRequestController.listForEmployee
);
router.get(
  '/:id/uploaded-documents',
  requireRole(USER_ROLES.ADMIN),
  validate(uploadedDocumentValidator.listForEmployee),
  uploadedDocumentController.listForEmployee
);

router.get(
  '/:id/activity',
  requireSelfOrAdmin(),
  validate(employeeValidator.getOrDelete),
  employeeController.activity
);

// Marking/editing attendance is admin-only — a worker can only read their
// own (requireSelfOrAdmin) and submit a modification request instead (see
// attendanceRequest.routes.js).
router.post('/:id/attendance', requireRole(USER_ROLES.ADMIN), validate(attendanceValidator.mark), attendanceController.mark);
router.get(
  '/:id/attendance',
  requireSelfOrAdmin(),
  validate(attendanceValidator.listForEmployee),
  attendanceController.listForEmployee
);
router.get(
  '/:id/attendance/summary',
  requireSelfOrAdmin(),
  validate(attendanceValidator.getSummary),
  attendanceController.getSummary
);

router.post(
  '/:id/salary-slips/generate',
  requireRole(USER_ROLES.ADMIN),
  validate(salarySlipValidator.generate),
  salarySlipController.generate
);
router.get(
  '/:id/salary-slips',
  requireRole(USER_ROLES.ADMIN),
  validate(salarySlipValidator.listForEmployee),
  salarySlipController.listForEmployee
);

module.exports = router;
