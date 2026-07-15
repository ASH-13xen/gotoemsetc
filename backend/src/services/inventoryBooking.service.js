const ApiError = require('../utils/ApiError');
const inventoryItemRepository = require('../repositories/inventoryItem.repository');
const inventoryBookingRepository = require('../repositories/inventoryBooking.repository');
const {
  INVENTORY_BOOKING_STATUS,
  INVENTORY_RELEASED_BY_ROLE,
  INVENTORY_BOOKING_CONTEXT,
  USER_ROLES,
} = require('../config/constants');

// A booking locks `quantity` units the moment it's created — this is a
// physical-checkout model (like signing gear out of a cage), not a calendar
// reservation. startDate/endDate are what the booker expects to need it
// for (shown on the lock, used to flag it overdue) but do NOT gate future
// bookings against a date-range conflict — availability is just "how much
// is currently locked right now," see inventoryItem.service.js.
async function createBooking(itemId, { quantity, startDate, endDate, context, event, clientTask, notes }, actingEmployeeId) {
  const item = await inventoryItemRepository.findById(itemId);
  if (!item) throw ApiError.notFound('Inventory item not found');

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw ApiError.badRequest('End date must be on or after the start date');

  if (context === INVENTORY_BOOKING_CONTEXT.EVENT && !event) {
    throw ApiError.badRequest('Select an event for this booking');
  }
  if (context === INVENTORY_BOOKING_CONTEXT.CLIENT_TASK && !clientTask) {
    throw ApiError.badRequest("Select a client's task for this booking");
  }

  const lockedMap = await inventoryBookingRepository.sumActiveByItem();
  const locked = lockedMap[itemId.toString()] || 0;
  const available = item.totalQuantity - locked;
  if (quantity > available) {
    throw ApiError.badRequest(`Only ${available} of "${item.name}" available right now`);
  }

  return inventoryBookingRepository.create({
    item: itemId,
    quantity,
    bookedBy: actingEmployeeId || undefined,
    startDate: start,
    endDate: end,
    context,
    event: context === INVENTORY_BOOKING_CONTEXT.EVENT ? event : undefined,
    clientTask: context === INVENTORY_BOOKING_CONTEXT.CLIENT_TASK ? clientTask : undefined,
    notes,
  });
}

// Both the booker's own "I'm done with it" check-in and an admin's
// forced release go through here — the only thing that differs is who's
// allowed to call it and what gets stamped, which drives the frontend's
// "Checked in by X" / "Unlocked early by admin" / "Opened by admin" copy.
async function releaseBooking(bookingId, actingUser) {
  const booking = await inventoryBookingRepository.findRaw(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status === INVENTORY_BOOKING_STATUS.RELEASED) {
    throw ApiError.badRequest('This booking has already been released');
  }

  const isAdmin = actingUser.role === USER_ROLES.ADMIN;
  const isOwner =
    Boolean(actingUser.employeeLink) &&
    Boolean(booking.bookedBy) &&
    booking.bookedBy.toString() === actingUser.employeeLink.toString();
  if (!isAdmin && !isOwner) {
    throw ApiError.forbidden('Only the employee who booked this item, or an admin, can release it');
  }

  const now = new Date();
  return inventoryBookingRepository.updateById(bookingId, {
    status: INVENTORY_BOOKING_STATUS.RELEASED,
    releasedAt: now,
    releasedByRole: isAdmin ? INVENTORY_RELEASED_BY_ROLE.ADMIN : INVENTORY_RELEASED_BY_ROLE.EMPLOYEE,
    releasedBy: isAdmin ? undefined : actingUser.employeeLink,
    releasedEarly: now < booking.endDate,
  });
}

async function listForItem(itemId) {
  return inventoryBookingRepository.listForItem(itemId);
}

async function listMyBookings(employeeId) {
  return inventoryBookingRepository.listForEmployee(employeeId);
}

module.exports = { createBooking, releaseBooking, listForItem, listMyBookings };
