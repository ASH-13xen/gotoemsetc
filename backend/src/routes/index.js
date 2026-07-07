const { Router } = require('express');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const auditLogger = require('../middlewares/auditLog.middleware');
const { USER_ROLES } = require('../config/constants');

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
const userRoutes = require('./user.routes');
const auditLogRoutes = require('./auditLog.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/public', publicRoutes);

// Everything below requires a valid JWT.
router.use(verifyToken);
router.use(auditLogger);

router.use('/employees', employeeRoutes);
router.use('/templates', templateRoutes);
router.use('/documents', documentRoutes);
router.use('/upload-requests', uploadRequestRoutes);
router.use('/uploaded-documents', uploadedDocumentRoutes);
router.use('/config', configRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/applicants', applicantRoutes);
router.use('/clients', clientRoutes);
router.use('/quotation-templates', quotationTemplateRoutes);
router.use('/quotations', quotationRoutes);
router.use('/teams', teamRoutes);
router.use('/tasks', taskRoutes);
router.use('/users', requireRole(USER_ROLES.ADMIN), userRoutes);
router.use('/audit-log', requireRole(USER_ROLES.ADMIN), auditLogRoutes);

module.exports = router;
