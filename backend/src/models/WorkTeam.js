const { Schema, model } = require('mongoose');

// Employee Task Management's team registry — distinct from the existing
// Team model (which belongs to the unrelated content-agency Task/TaskCycle
// system). leader is required here (unlike the old Team's optional leader)
// since Team-task completion routing depends on there always being someone
// to route to.
const workTeamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    leader: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('WorkTeam', workTeamSchema);
