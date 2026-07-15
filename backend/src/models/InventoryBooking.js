const { Schema, model } = require('mongoose');
const {
  INVENTORY_BOOKING_CONTEXT,
  INVENTORY_BOOKING_STATUS,
  INVENTORY_RELEASED_BY_ROLE,
} = require('../config/constants');

// One booking = one lock on `quantity` units of an item, from creation
// until it's released — not a calendar reservation. Duration
// (startDate/endDate) is what the booker expects to need it for, shown
// alongside the lock and used to flag it overdue, but a booking does NOT
// auto-release when endDate passes; it stays locked until an explicit
// check-in (by the booker) or admin release (see inventoryBooking.service.js).
const inventoryBookingSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    // Who has it locked — null only when an admin account with no linked
    // Employee record made the booking (see task.controller.js's same
    // admin-attribution pattern); the frontend shows "Admin" in that case.
    bookedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // "Reason" in the product ask IS this selection (event / a client's
    // task / other) — not a separate freeform taxonomy.
    context: { type: String, enum: Object.values(INVENTORY_BOOKING_CONTEXT), required: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    clientTask: { type: Schema.Types.ObjectId, ref: 'Task' },
    // Always available regardless of context — the "additional text box".
    notes: { type: String, trim: true },

    status: { type: String, enum: Object.values(INVENTORY_BOOKING_STATUS), default: INVENTORY_BOOKING_STATUS.ACTIVE },
    releasedAt: { type: Date },
    // Set only when an employee (the booker) releases it — null on an admin
    // release, same null-means-admin convention as bookedBy.
    releasedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    releasedByRole: { type: String, enum: Object.values(INVENTORY_RELEASED_BY_ROLE) },
    // True when an admin released it before endDate ("unlocked early by
    // admin") vs after ("opened by admin") — meaningless for an employee
    // check-in, which is always just "checked in by <name>".
    releasedEarly: { type: Boolean },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

inventoryBookingSchema.index({ item: 1, status: 1 });

module.exports = model('InventoryBooking', inventoryBookingSchema);
