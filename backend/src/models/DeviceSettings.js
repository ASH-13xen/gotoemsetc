const { Schema, model } = require('mongoose');
const { ACCESS_DEVICE_TYPES, ACCESS_ITEM_KINDS } = require('../utils/deviceCatalog');

// HR Work → Devices settings — one document (key 'main'):
//  - the apps a company phone must carry;
//  - the brand kit every phone's WhatsApp Business / Truecaller profile uses;
//  - the access matrix: per designation, what goes on each device type
//    (company phone, personal phone, office laptop, personal laptop);
//  - when the monthly check is due and what counts as low storage / battery.
const deviceSettingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    apps: [
      {
        _id: false,
        key: { type: String, required: true },
        label: { type: String, required: true },
        required: { type: Boolean, default: true },
      },
    ],
    brand: {
      whatsappName: { type: String, trim: true },
      bio: { type: String, trim: true },
      website: { type: String, trim: true },
      address: { type: String, trim: true },
      logo: { type: Schema.Types.ObjectId, ref: 'DeviceFile', default: null },
      brochure: { type: Schema.Types.ObjectId, ref: 'DeviceFile', default: null },
    },
    // The company Google account every phone shares its location with (Google
    // Maps → Location sharing) — HR sees all the phones on its map.
    locationAccount: { type: String, trim: true },
    // Default apps already offered, so a new default is added once to an
    // existing list while one HR removed stays removed.
    appDefaultsSeen: [String],
    accessTemplates: [
      {
        _id: false,
        designation: { type: String, required: true, trim: true }, // matched case-insensitively; '*' = everyone
        deviceType: { type: String, enum: Object.keys(ACCESS_DEVICE_TYPES), required: true },
        items: [
          {
            _id: false,
            key: { type: String, required: true },
            kind: { type: String, enum: Object.keys(ACCESS_ITEM_KINDS), default: 'app' },
            label: { type: String, required: true, trim: true },
            detail: { type: String, trim: true },
          },
        ],
      },
    ],
    checkDueDay: { type: Number, default: 7, min: 1, max: 28 },
    lowStoragePct: { type: Number, default: 15, min: 1, max: 90 },
    lowBatteryPct: { type: Number, default: 80, min: 1, max: 100 },
  },
  { timestamps: true }
);

module.exports = model('DeviceSettings', deviceSettingsSchema);
