const { Schema, model } = require('mongoose');

// The "topic" an inventory item is filed under — created inline while
// adding an item (admin types a new one or picks an existing one), and
// reused afterward the same way a step-library entry is.
const inventoryCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('InventoryCategory', inventoryCategorySchema);
