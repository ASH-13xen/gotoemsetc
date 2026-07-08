const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const taskValidator = require('../validators/task.validator');
const taskController = require('../controllers/task.controller');

const router = Router();

router.get('/', validate(taskValidator.list), taskController.list);
router.post('/', validate(taskValidator.create), taskController.create);
router.get('/due-summary', taskController.dueSummary);
router.get('/:id', validate(taskValidator.getOrDelete), taskController.getById);
router.patch('/:id', validate(taskValidator.update), taskController.update);
router.patch('/:id/status', validate(taskValidator.updateStatus), taskController.updateStatus);
router.delete('/:id', validate(taskValidator.getOrDelete), taskController.remove);
router.post('/:id/comments', validate(taskValidator.comment), taskController.addComment);
router.post(
  '/:id/attachments',
  validate(taskValidator.getOrDelete),
  upload.single('file'),
  taskController.uploadAttachment
);
router.delete(
  '/:id/attachments/:attachmentId',
  validate(taskValidator.removeAttachment),
  taskController.removeAttachment
);

module.exports = router;
