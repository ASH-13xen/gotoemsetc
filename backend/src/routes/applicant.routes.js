const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const resumeUpload = require('../middlewares/resumeUpload.middleware');
const applicantValidator = require('../validators/applicant.validator');
const applicantController = require('../controllers/applicant.controller');

const router = Router();

router.get('/', validate(applicantValidator.list), applicantController.list);
router.post(
  '/',
  resumeUpload.single('resume'),
  validate(applicantValidator.create),
  applicantController.create
);
router.get('/:id', validate(applicantValidator.getOrDelete), applicantController.getById);
router.patch('/:id', validate(applicantValidator.update), applicantController.update);
router.delete('/:id', validate(applicantValidator.getOrDelete), applicantController.remove);
router.post('/:id/hire', validate(applicantValidator.hire), applicantController.hire);
router.post('/:id/reject', validate(applicantValidator.reject), applicantController.reject);

module.exports = router;
