const { Schema, model } = require('mongoose');
const { USER_ROLES } = require('../config/constants');

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(USER_ROLES), required: true },
    employeeLink: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
