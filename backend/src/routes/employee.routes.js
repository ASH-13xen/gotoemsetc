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
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');

const router = Router();

router.get('/', validate(employeeValidator.list), employeeController.list);
router.post('/', validate(employeeValidator.create), employeeController.create);
router.get('/:id', validate(employeeValidator.getOrDelete), employeeController.getById);
router.patch('/:id', validate(employeeValidator.update), employeeController.update);
router.delete('/:id', validate(employeeValidator.getOrDelete), employeeController.remove);

router.post(
  '/:id/documents/generate',
  validate(documentGenerationValidator.generate),
  documentController.generate
);
router.get(
  '/:id/documents',
  validate(documentGenerationValidator.listForEmployee),
  documentController.listForEmployee
);

router.post(
  '/:id/upload-requests',
  validate(uploadRequestValidator.create),
  uploadRequestController.create
);
router.get(
  '/:id/upload-requests',
  validate(uploadRequestValidator.listForEmployee),
  uploadRequestController.listForEmployee
);
router.get(
  '/:id/uploaded-documents',
  validate(uploadedDocumentValidator.listForEmployee),
  uploadedDocumentController.listForEmployee
);

router.get('/:id/activity', validate(employeeValidator.getOrDelete), employeeController.activity);

router.post('/:id/attendance', validate(attendanceValidator.mark), attendanceController.mark);
router.get('/:id/attendance', validate(attendanceValidator.listForEmployee), attendanceController.listForEmployee);
router.get('/:id/attendance/summary', validate(attendanceValidator.getSummary), attendanceController.getSummary);

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
