const { Schema, model } = require('mongoose');

// Reusable, admin-managed step names (Plan of Action, Shoot, Edit, ...) —
// picked from when building a quotation template's Scope of Work section
// pipelines, instead of retyping the same steps for every template.
const stepLibrarySchema = new Schema(
  {
    label: { type: String, required: true, trim: true, unique: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('StepLibrary', stepLibrarySchema);
