const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireFinanceAccess } = require('../middlewares/auth.middleware');
const fnfSettlementValidator = require('../validators/fnfSettlement.validator');
const fnfSettlementController = require('../controllers/fnfSettlement.controller');

const router = Router();

router.use(requireFinanceAccess());

router.get('/', fnfSettlementController.list);
router.post('/:id/mark-paid', validate(fnfSettlementValidator.markPaid), fnfSettlementController.markPaid);

module.exports = router;
