const ApiError = require('../utils/ApiError');
const inventoryItemRepository = require('../repositories/inventoryItem.repository');
const inventoryBookingRepository = require('../repositories/inventoryBooking.repository');
const inventoryCategoryRepository = require('../repositories/inventoryCategory.repository');
const inventoryCategoryService = require('./inventoryCategory.service');
const cloudinaryUploadService = require('./cloudinaryUpload.service');

function withAvailability(item, lockedMap) {
  const plain = item.toObject ? item.toObject() : item;
  const locked = lockedMap[plain._id.toString()] || 0;
  return { ...plain, lockedQuantity: locked, availableQuantity: Math.max(0, plain.totalQuantity - locked) };
}

async function resolveCategory({ categoryId, newCategoryName }) {
  if (categoryId) {
    const category = await inventoryCategoryRepository.findById(categoryId);
    if (!category) throw ApiError.badRequest('Category not found');
    return category;
  }
  if (newCategoryName && newCategoryName.trim()) return inventoryCategoryService.getOrCreateCategory(newCategoryName);
  throw ApiError.badRequest('A category is required');
}

async function uploadPhoto(file) {
  const upload = await cloudinaryUploadService.uploadBuffer(file.buffer, {
    folder: 'ems/inventory',
    publicId: `item-${Date.now()}`,
    resourceType: 'image',
  });
  return upload.secure_url;
}

async function listItems() {
  const [items, lockedMap] = await Promise.all([
    inventoryItemRepository.list(),
    inventoryBookingRepository.sumActiveByItem(),
  ]);
  return items.map((item) => withAvailability(item, lockedMap));
}

async function getItem(id) {
  const item = await inventoryItemRepository.findById(id);
  if (!item) throw ApiError.notFound('Inventory item not found');
  const [lockedMap, activeBookings] = await Promise.all([
    inventoryBookingRepository.sumActiveByItem(),
    inventoryBookingRepository.listActiveForItem(id),
  ]);
  return { item: withAvailability(item, lockedMap), activeBookings };
}

async function createItem({ name, description, totalQuantity, categoryId, newCategoryName }, photoFile) {
  const category = await resolveCategory({ categoryId, newCategoryName });
  const photoUrl = photoFile ? await uploadPhoto(photoFile) : undefined;

  return inventoryItemRepository.create({
    name,
    description,
    totalQuantity,
    category: category._id,
    ...(photoUrl ? { photoUrl } : {}),
  });
}

async function updateItem(id, { name, description, totalQuantity, categoryId, newCategoryName }, photoFile) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (totalQuantity !== undefined) patch.totalQuantity = totalQuantity;
  if (categoryId || newCategoryName) {
    const category = await resolveCategory({ categoryId, newCategoryName });
    patch.category = category._id;
  }
  if (photoFile) patch.photoUrl = await uploadPhoto(photoFile);

  const item = await inventoryItemRepository.updateById(id, patch);
  if (!item) throw ApiError.notFound('Inventory item not found');
  return item;
}

async function deleteItem(id) {
  const active = await inventoryBookingRepository.listActiveForItem(id);
  if (active.length > 0) {
    throw ApiError.badRequest('This item has active bookings — release them before deleting it');
  }
  const item = await inventoryItemRepository.softDeleteById(id);
  if (!item) throw ApiError.notFound('Inventory item not found');
  return item;
}

module.exports = { listItems, getItem, createItem, updateItem, deleteItem };
