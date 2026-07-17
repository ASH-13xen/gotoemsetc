const { Schema, model } = require('mongoose');
const { USER_ROLES, PERMISSIONS } = require('../config/constants');

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(USER_ROLES), required: true },
    employeeLink: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
    // Only meaningful for role: worker — an admin always has full access
    // regardless of what's (or isn't) listed here.
    permissions: { type: [String], enum: Object.values(PERMISSIONS), default: [] },
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
