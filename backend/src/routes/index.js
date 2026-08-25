const { Router } = require('express');
const { verifyToken, requireRole, requirePermission, requireHrWorkAccess } = require('../middlewares/auth.middleware');
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
const holidayRoutes = require('./holiday.routes');
const companyEventRoutes = require('./companyEvent.routes');
const companyCalendarRoutes = require('./companyCalendar.routes');
const salarySlipRoutes = require('./salarySlip.routes');
const userRoutes = require('./user.routes');
const auditLogRoutes = require('./auditLog.routes');
const notificationRoutes = require('./notification.routes');
const eventRoutes = require('./event.routes');
const devicePunchRoutes = require('./devicePunch.routes');
const attendanceRequestRoutes = require('./attendanceRequest.routes');
const workTeamRoutes = require('./workTeam.routes');
const taskClientRoutes = require('./taskClient.routes');
const taskEventRoutes = require('./taskEvent.routes');
const employeeTaskRoutes = require('./employeeTask.routes');
const cmsRoutes = require('./cms.routes');
const attendanceWarningRoutes = require('./attendanceWarning.routes');
const attendanceOverviewRoutes = require('./attendanceOverview.routes');
const inventoryReportRoutes = require('./inventoryReport.routes');
const complaintRoutes = require('./complaint.routes');
const keyHolderRoutes = require('./keyHolder.routes');
const meetingRoutes = require('./meeting.routes');
const fnfSettlementRoutes = require('./fnfSettlement.routes');
const monthlyBillRoutes = require('./monthlyBill.routes');
const reimbursementRoutes = require('./reimbursement.routes');
const invoiceRoutes = require('./invoice.routes');
const announcementRoutes = require('./announcement.routes');

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
router.use('/holidays', holidayRoutes);
router.use('/company-events', companyEventRoutes);
router.use('/company-calendar', companyCalendarRoutes);
router.use('/salary-slips', salarySlipRoutes);
router.use('/notifications', notificationRoutes);
// Event Management — admin/HR only.
router.use('/events', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), eventRoutes);
router.use('/device-punches', devicePunchRoutes);
router.use('/attendance-requests', attendanceRequestRoutes);
// Task Management. Every employee needs access here; admin/HR-only vs.
// self-service capability differences are branched per-route inside each
// router rather than gated at the mount. WorkTeam/TaskClient are the single
// team/client registries — the parallel Team/Client models the old sales CMS
// used were removed in the Client Management System rebuild.
router.use('/work-teams', workTeamRoutes);
router.use('/task-clients', taskClientRoutes);
router.use('/task-events', taskEventRoutes);
router.use('/employee-tasks', employeeTaskRoutes);
// Client Management System — the client registry itself stays on
// /task-clients (shared with Task Management); this mount is the calendars,
// scheduled content, and approval workflow built on top of it. Gated
// per-route inside, since read/write/schedule/approve each have a different
// audience — see cms.routes.js.
router.use('/cms', cmsRoutes);
// Client Manual — Meetings/MOM. Same open-read/service-checked-write shape
// as /cms — see meeting.routes.js.
router.use('/meetings', meetingRoutes);
// Finance section. Gated inside each router (requireFinanceAccess or a
// narrower/wider variant per section — see auth.middleware.js).
router.use('/fnf-settlements', fnfSettlementRoutes);
router.use('/monthly-bills', monthlyBillRoutes);
router.use('/reimbursements', reimbursementRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/attendance-warnings', attendanceWarningRoutes);
// HR Work's org-wide monthly attendance overview (frontendhr) — the only
// attendance endpoint that isn't nested under /employees/:id, since it's
// never scoped to one employee.
router.use('/attendance', requireHrWorkAccess(), attendanceOverviewRoutes);
// HR Work's inventory column-picker report (frontendhr).
router.use('/inventory-report', requireHrWorkAccess(), inventoryReportRoutes);
// Operations — Complaint Register. Every employee can file/browse/review
// their own; list-everyone and mark-completed are Operations-only
// (admin/ceo/operations_manager, explicitly NOT hr), gated per-route inside
// complaint.routes.js.
router.use('/complaints', complaintRoutes);
// Office key holders — read open to everyone, reassigning gated per-route
// inside keyHolder.routes.js (same admin/ceo/operations_manager set).
router.use('/keys', keyHolderRoutes);
// Gated per-route inside user.routes.js — some actions there are reachable
// by a worker with add_credentials, not just admins.
router.use('/users', userRoutes);
router.use('/audit-log', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), auditLogRoutes);
// Announcements — gated per-route inside announcement.routes.js (reading/
// acknowledging your own is open to everyone; creating and the full
// management list are every non-worker role).
router.use('/announcements', announcementRoutes);

module.exports = router;
