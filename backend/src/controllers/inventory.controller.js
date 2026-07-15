const asyncHandler = require('../utils/asyncHandler');
const inventoryCategoryService = require('../services/inventoryCategory.service');
const inventoryItemService = require('../services/inventoryItem.service');
const inventoryBookingService = require('../services/inventoryBooking.service');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await inventoryCategoryService.listCategories();
  res.json({ categories });
});

const listItems = asyncHandler(async (req, res) => {
  const items = await inventoryItemService.listItems();
  res.json({ items });
});

const getItem = asyncHandler(async (req, res) => {
  const result = await inventoryItemService.getItem(req.params.id);
  res.json(result);
});

const createItem = asyncHandler(async (req, res) => {
  const item = await inventoryItemService.createItem(req.body, req.file);
  req.auditContext = { action: 'inventoryItem.create', resourceType: 'InventoryItem', resourceId: item._id, metadata: { name: item.name } };
  res.status(201).json({ item });
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await inventoryItemService.updateItem(req.params.id, req.body, req.file);
  req.auditContext = { action: 'inventoryItem.update', resourceType: 'InventoryItem', resourceId: item._id, metadata: req.body };
  res.json({ item });
});

const deleteItem = asyncHandler(async (req, res) => {
  await inventoryItemService.deleteItem(req.params.id);
  req.auditContext = { action: 'inventoryItem.delete', resourceType: 'InventoryItem', resourceId: req.params.id };
  res.status(204).send();
});

const createBooking = asyncHandler(async (req, res) => {
  const booking = await inventoryBookingService.createBooking(req.params.id, req.body, req.user.employeeLink);
  res.status(201).json({ booking });
});

const listBookingsForItem = asyncHandler(async (req, res) => {
  const bookings = await inventoryBookingService.listForItem(req.params.id);
  res.json({ bookings });
});

const listMyBookings = asyncHandler(async (req, res) => {
  const bookings = req.user.employeeLink ? await inventoryBookingService.listMyBookings(req.user.employeeLink) : [];
  res.json({ bookings });
});

const releaseBooking = asyncHandler(async (req, res) => {
  const booking = await inventoryBookingService.releaseBooking(req.params.id, req.user);
  res.json({ booking });
});

module.exports = {
  listCategories,
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  createBooking,
  listBookingsForItem,
  listMyBookings,
  releaseBooking,
};
