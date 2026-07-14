const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { requireClientAccess } = require('../middlewares/clientAccess.middleware');
const clientValidator = require('../validators/client.validator');
const clientController = require('../controllers/client.controller');
const meetingValidator = require('../validators/meeting.validator');
const meetingController = require('../controllers/meeting.controller');
const quotationValidator = require('../validators/quotation.validator');
const quotationController = require('../controllers/quotation.controller');
const clientNoteValidator = require('../validators/clientNote.validator');
const clientNoteController = require('../controllers/clientNote.controller');
const clientDocumentRequestValidator = require('../validators/clientDocumentRequest.validator');
const clientDocumentRequestController = require('../controllers/clientDocumentRequest.controller');
const taskValidator = require('../validators/task.validator');
const taskController = require('../controllers/task.controller');

const router = Router();

router.get('/', validate(clientValidator.list), clientController.list);
router.post('/', validate(clientValidator.register), clientController.register);
router.get('/:id', validate(clientValidator.getOrDelete), clientController.getById);
router.patch('/:id', validate(clientValidator.update), clientController.update);
router.delete('/:id', validate(clientValidator.getOrDelete), clientController.remove);

router.post('/:id/contacts', validate(clientValidator.addContact), clientController.addContact);
router.delete(
  '/:id/contacts/:contactId',
  validate(clientValidator.removeContact),
  clientController.removeContact
);

router.post('/:id/offboard', validate(clientValidator.getOrDelete), clientController.offboard);
router.get('/:id/activity', validate(clientValidator.getOrDelete), clientController.activity);
router.post('/:id/logo', validate(clientValidator.getOrDelete), upload.single('logo'), clientController.uploadLogo);

router.get(
  '/:id/tasks',
  validate(taskValidator.listForClient),
  requireClientAccess(),
  taskController.listForClient
);
router.post(
  '/:id/tasks/sync',
  validate(taskValidator.syncCycle),
  requireClientAccess(),
  taskController.syncCycle
);

router.post('/:id/meetings', validate(meetingValidator.create), meetingController.create);
router.get('/:id/meetings', validate(meetingValidator.listForClient), meetingController.listForClient);
router.patch(
  '/:id/meetings/:meetingId',
  validate(meetingValidator.updateMinutes),
  meetingController.updateMinutes
);

router.get('/:id/quotations', validate(quotationValidator.listForClient), quotationController.listForClient);
router.post('/:id/quotations', validate(quotationValidator.generate), quotationController.generate);

router.post('/:id/notes', validate(clientNoteValidator.create), clientNoteController.create);
router.get('/:id/notes', validate(clientNoteValidator.listForClient), clientNoteController.listForClient);
router.delete('/:id/notes/:noteId', validate(clientNoteValidator.remove), clientNoteController.remove);

router.post(
  '/:id/document-requests',
  validate(clientDocumentRequestValidator.create),
  clientDocumentRequestController.create
);
router.get(
  '/:id/document-requests',
  validate(clientDocumentRequestValidator.listForClient),
  clientDocumentRequestController.listForClient
);
router.get(
  '/:id/uploaded-documents',
  validate(clientDocumentRequestValidator.listForClient),
  clientDocumentRequestController.listUploaded
);

module.exports = router;
