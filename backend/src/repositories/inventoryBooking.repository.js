const InventoryBooking = require('../models/InventoryBooking');
const { INVENTORY_BOOKING_STATUS } = require('../config/constants');

const POPULATE = [
  { path: 'bookedBy', select: 'firstName lastName designation employeeCode' },
  { path: 'releasedBy', select: 'firstName lastName designation employeeCode' },
  { path: 'event', select: 'title' },
  { path: 'clientTask', select: 'itemLabel sectionName client', populate: { path: 'client', select: 'clientName brandName' } },
];

function create(data) {
  return InventoryBooking.create(data);
}

function findById(id) {
  return InventoryBooking.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function findRaw(id) {
  return InventoryBooking.findOne({ _id: id, isDeleted: false });
}

function listForItem(itemId) {
  return InventoryBooking.find({ item: itemId, isDeleted: false }).sort({ createdAt: -1 }).populate(POPULATE);
}

function listActiveForItem(itemId) {
  return InventoryBooking.find({ item: itemId, status: INVENTORY_BOOKING_STATUS.ACTIVE, isDeleted: false }).populate(POPULATE);
}

function listForEmployee(employeeId) {
  return InventoryBooking.find({ bookedBy: employeeId, status: INVENTORY_BOOKING_STATUS.ACTIVE, isDeleted: false })
    .sort({ endDate: 1 })
    .populate([{ path: 'item', select: 'name photoUrl' }, ...POPULATE]);
}

// One aggregate query for however many items are being listed, rather than
// an availability query per item — { <itemId>: lockedQuantity }.
async function sumActiveByItem() {
  const rows = await InventoryBooking.aggregate([
    { $match: { status: INVENTORY_BOOKING_STATUS.ACTIVE, isDeleted: false } },
    { $group: { _id: '$item', locked: { $sum: '$quantity' } } },
  ]);
  const map = {};
  for (const row of rows) map[row._id.toString()] = row.locked;
  return map;
}

function updateById(id, patch) {
  return InventoryBooking.findOneAndUpdate({ _id: id, isDeleted: false }, patch, { new: true }).populate(POPULATE);
}

module.exports = {
  create,
  findById,
  findRaw,
  listForItem,
  listActiveForItem,
  listForEmployee,
  sumActiveByItem,
  updateById,
};
