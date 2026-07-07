const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const clientValidator = require('../validators/client.validator');
const clientController = require('../controllers/client.controller');
const meetingValidator = require('../validators/meeting.validator');
const meetingController = require('../controllers/meeting.controller');
const quotationValidator = require('../validators/quotation.validator');
const quotationController = require('../controllers/quotation.controller');

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

router.post('/:id/meetings', validate(meetingValidator.create), meetingController.create);
router.get('/:id/meetings', validate(meetingValidator.listForClient), meetingController.listForClient);

router.get('/:id/quotations', validate(quotationValidator.listForClient), quotationController.listForClient);
router.post('/:id/quotations', validate(quotationValidator.generate), quotationController.generate);

module.exports = router;
