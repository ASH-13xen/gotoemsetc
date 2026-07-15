const { Schema, model } = require('mongoose');
const { EVENT_RESPONSIBILITY_STATUS } = require('../config/constants');

// A single assigned responsibility for an event — deliberately much
// simpler than Task Management's Task (no step pipeline, no approval gate,
// just "what" and "who" and a done/not-done checkbox), since the product
// ask is explicit that this is a different, lighter-weight kind of task.
const eventResponsibilitySchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    title: { type: String, required: true, trim: true },
    assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    assignedTeam: { type: Schema.Types.ObjectId, ref: 'Team' },
    // Both independently optional — a responsibility can have neither, one,
    // or both of a due date and a time window.
    dueDate: { type: Date },
    startTime: { type: Date },
    endTime: { type: Date },
    status: { type: String, enum: Object.values(EVENT_RESPONSIBILITY_STATUS), default: EVENT_RESPONSIBILITY_STATUS.PENDING },
    completedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    completedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('EventResponsibility', eventResponsibilitySchema);
