const { Schema, model } = require('mongoose');

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    isStanding: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('Team', teamSchema);
