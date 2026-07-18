const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const inventoryValidator = require('../validators/inventory.validator');
const inventoryController = require('../controllers/inventory.controller');

const router = Router();

router.get('/categories', inventoryController.listCategories);

router.get('/items', inventoryController.listItems);
router.get('/items/:id', validate(inventoryValidator.getOrDeleteItem), inventoryController.getItem);
// Only admin adds/edits/removes items from the pool — booking them is open
// to any employee.
router.post(
  '/items',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  upload.single('photo'),
  validate(inventoryValidator.createItem),
  inventoryController.createItem
);
router.patch(
  '/items/:id',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  upload.single('photo'),
  validate(inventoryValidator.updateItem),
  inventoryController.updateItem
);
router.delete(
  '/items/:id',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(inventoryValidator.getOrDeleteItem),
  inventoryController.deleteItem
);

router.post(
  '/items/:id/bookings',
  validate(inventoryValidator.createBooking),
  inventoryController.createBooking
);
router.get(
  '/items/:id/bookings',
  validate(inventoryValidator.getOrDeleteItem),
  inventoryController.listBookingsForItem
);

router.get('/my-bookings', inventoryController.listMyBookings);

router.post(
  '/bookings/:id/release',
  validate(inventoryValidator.releaseBooking),
  inventoryController.releaseBooking
);

module.exports = router;
