const { Schema, model } = require('mongoose');

// Employee Task Management's own lightweight event registry — distinct
// from the paused Event Management feature's Event model (coordinator,
// reschedule history, summary workflow). Just a name + description, per
// the user's spec.
const taskEventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('TaskEvent', taskEventSchema);
