const { Schema, model } = require('mongoose');

// Employee Task Management's own lightweight client registry — distinct
// from the CRM Client model (contacts/quotations/chat access, shared with
// frontendsales). Deliberately just a name + logo, per the user's spec.
const taskClientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    logoUrl: { type: String },
    // The team that handles this client's work by default — auto-selected
    // (editable) when a Client task is created for this client, see
    // employeeTask.validator.js / CreateTaskDialog.tsx.
    defaultTeam: { type: Schema.Types.ObjectId, ref: 'WorkTeam', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('TaskClient', taskClientSchema);
