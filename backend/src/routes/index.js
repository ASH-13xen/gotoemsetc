const { Router } = require('express');
const { verifyToken, requireRole, requirePermission } = require('../middlewares/auth.middleware');
const auditLogger = require('../middlewares/auditLog.middleware');
const { USER_ROLES, PERMISSIONS } = require('../config/constants');

const authRoutes = require('./auth.routes');
const employeeRoutes = require('./employee.routes');
const templateRoutes = require('./template.routes');
const documentRoutes = require('./document.routes');
const uploadRequestRoutes = require('./uploadRequest.routes');
const uploadedDocumentRoutes = require('./uploadedDocument.routes');
const publicRoutes = require('./public.routes');
const configRoutes = require('./config.routes');
const dashboardRoutes = require('./dashboard.routes');
const applicantRoutes = require('./applicant.routes');
const clientRoutes = require('./client.routes');
const quotationTemplateRoutes = require('./quotationTemplate.routes');
const quotationRoutes = require('./quotation.routes');
const teamRoutes = require('./team.routes');
const taskRoutes = require('./task.routes');
const stepLibraryRoutes = require('./stepLibrary.routes');
const holidayRoutes = require('./holiday.routes');
const salarySlipRoutes = require('./salarySlip.routes');
const userRoutes = require('./user.routes');
const auditLogRoutes = require('./auditLog.routes');
const notificationRoutes = require('./notification.routes');
const clientDocumentRequestRoutes = require('./clientDocumentRequest.routes');
const clientUploadedDocumentRoutes = require('./clientUploadedDocument.routes');
const inventoryRoutes = require('./inventory.routes');
const eventRoutes = require('./event.routes');
const devicePunchRoutes = require('./devicePunch.routes');
const attendanceRequestRoutes = require('./attendanceRequest.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/public', publicRoutes);
// Non-sensitive static config (doc type labels, whether email is set up) —
// PublicUploadPage needs this to render doc type names for unauthenticated
// applicants, so it must stay open rather than behind verifyToken.
router.use('/config', configRoutes);

// Everything below requires a valid JWT.
router.use(verifyToken);
router.use(auditLogger);

router.use('/employees', employeeRoutes);
router.use('/templates', templateRoutes);
// Document System — admin, or a worker granted the matching permission.
router.use('/documents', requirePermission(PERMISSIONS.GENERATE_DOCUMENTS), documentRoutes);
router.use('/upload-requests', requirePermission(PERMISSIONS.REQUEST_DOCUMENTS), uploadRequestRoutes);
router.use('/uploaded-documents', requirePermission(PERMISSIONS.REQUEST_DOCUMENTS), uploadedDocumentRoutes);
router.use('/dashboard', dashboardRoutes);
// Recruitment/Applicants — admin, or a worker granted view_applicants.
router.use('/applicants', requirePermission(PERMISSIONS.VIEW_APPLICANTS), applicantRoutes);
// Client Management (CMS) — fully admin-only.
router.use('/clients', requireRole(USER_ROLES.ADMIN), clientRoutes);
router.use('/quotation-templates', requireRole(USER_ROLES.ADMIN), quotationTemplateRoutes);
router.use('/quotations', requireRole(USER_ROLES.ADMIN), quotationRoutes);
router.use('/client-document-requests', requireRole(USER_ROLES.ADMIN), clientDocumentRequestRoutes);
router.use('/client-uploaded-documents', requireRole(USER_ROLES.ADMIN), clientUploadedDocumentRoutes);
// Task Management — fully admin-only.
router.use('/teams', requireRole(USER_ROLES.ADMIN), teamRoutes);
router.use('/tasks', requireRole(USER_ROLES.ADMIN), taskRoutes);
router.use('/step-library', requireRole(USER_ROLES.ADMIN), stepLibraryRoutes);
router.use('/holidays', holidayRoutes);
router.use('/salary-slips', salarySlipRoutes);
router.use('/notifications', notificationRoutes);
// Inventory / Event Management — fully admin-only.
router.use('/inventory', requireRole(USER_ROLES.ADMIN), inventoryRoutes);
router.use('/events', requireRole(USER_ROLES.ADMIN), eventRoutes);
router.use('/device-punches', devicePunchRoutes);
router.use('/attendance-requests', attendanceRequestRoutes);
// Gated per-route inside user.routes.js — some actions there are reachable
// by a worker with add_credentials, not just admins.
router.use('/users', userRoutes);
router.use('/audit-log', requireRole(USER_ROLES.ADMIN), auditLogRoutes);

module.exports = router;
