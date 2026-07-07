const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const teamValidator = require('../validators/team.validator');
const teamController = require('../controllers/team.controller');

const router = Router();

router.get('/', teamController.list);
router.post('/', validate(teamValidator.create), teamController.create);
router.get('/:id', validate(teamValidator.getOrDelete), teamController.getById);
router.patch('/:id', validate(teamValidator.update), teamController.update);
router.delete('/:id', validate(teamValidator.getOrDelete), teamController.remove);

module.exports = router;
