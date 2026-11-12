const { Schema, model } = require('mongoose');
const { ACCESSORY_KINDS } = require('../utils/deviceCatalog');

// A kind of accessory held in stock — "20W USB-C charger", "USB-C cable",
// "iPhone 13 back cover". `totalQty` is how many the company owns; how many
// are out is counted from the active handovers (device.service.js).
const deviceAccessorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: Object.keys(ACCESSORY_KINDS), default: 'other' },
    totalQty: { type: Number, default: 0, min: 0 },
    // Recovered per piece if one is not returned.
    unitValue: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = model('DeviceAccessory', deviceAccessorySchema);
