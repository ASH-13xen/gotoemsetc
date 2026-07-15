const { Schema, model } = require('mongoose');

// availableQuantity is never stored — it's always derived from
// totalQuantity minus whatever's currently booked (see
// inventoryItem.service.js), so it can't drift out of sync with bookings.
const inventoryItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'InventoryCategory', required: true },
    description: { type: String, trim: true },
    photoUrl: { type: String },
    totalQuantity: { type: Number, required: true, min: 1 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ name: 'text' });

module.exports = model('InventoryItem', inventoryItemSchema);
