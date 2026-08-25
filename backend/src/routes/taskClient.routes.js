const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireCmsWrite } = require('../middlewares/cmsAccess.middleware');
const upload = require('../middlewares/multer.middleware');
const taskClientValidator = require('../validators/taskClient.validator');
const taskClientController = require('../controllers/taskClient.controller');

const router = Router();

// Reads are open to any logged-in employee — Client-related tasks need every
// employee to be able to see the client registry. Writes go through
// requireCmsWrite: admin/sales, plus HR and manage_tasks holders, who owned
// this registry before the Client Management System existed.
router.get('/', taskClientController.list);
router.get('/:id', validate(taskClientValidator.getOrDelete), taskClientController.get);
// The generated client manual — same open-read audience as everything else
// here (downloadable by anybody who can already see the client).
router.get('/:id/manual', validate(taskClientValidator.getOrDelete), taskClientController.downloadManual);
router.post('/', requireCmsWrite(), validate(taskClientValidator.create), taskClientController.create);
router.patch('/:id', requireCmsWrite(), validate(taskClientValidator.update), taskClientController.update);
router.delete('/:id', requireCmsWrite(), validate(taskClientValidator.getOrDelete), taskClientController.remove);
router.post(
  '/:id/logo',
  requireCmsWrite(),
  validate(taskClientValidator.getOrDelete),
  upload.single('logo'),
  taskClientController.uploadLogo
);

module.exports = router;
