const { Schema, model } = require('mongoose');

const fieldSchema = new Schema(
  {
    key: { type: String, required: true }, // matches the {key} placeholder in the docx
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'number', 'date', 'select', 'currency', 'boolean'],
      default: 'text',
    },
    required: { type: Boolean, default: true },
    source: { type: String, enum: ['employee', 'computed', 'manual'], default: 'employee' },
    mapsTo: String, // dot-path into Employee schema, e.g. "designation" or "address.city"
    options: [String], // for type: 'select'
    defaultValue: String,
    group: { type: String, default: 'General' }, // groups fields into wizard steps
    order: { type: Number, default: 0 },
    helpText: String,
  },
  { _id: false }
);

const loopItemFieldSchema = new Schema(
  { key: String, label: String, type: { type: String, default: 'text' } },
  { _id: false }
);

const loopSchema = new Schema(
  {
    key: { type: String, required: true }, // matches {#key}...{/key} in the docx
    label: String,
    itemFields: [loopItemFieldSchema],
  },
  { _id: false }
);

const documentTemplateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g. 'offer-letter'
    title: { type: String, required: true },
    description: String,
    category: {
      type: String,
      enum: ['onboarding', 'compliance', 'policy', 'offboarding', 'other'],
      default: 'onboarding',
    },
    // 'docx' fills a Word template via docxtemplater (legacy path); 'html'
    // fills an HTML template and renders it to PDF via a headless browser
    // (see htmlRender.service.js) — new templates should prefer 'html',
    // since text sizing/wrapping is handled by real CSS instead of Word's
    // layout engine plus a LibreOffice conversion step.
    templateType: { type: String, enum: ['docx', 'html'], default: 'docx' },
    // Exactly one of these is set, matching templateType.
    docxFilePath: String, // relative path under templates/files/
    htmlFilePath: String, // relative path under templates/html/
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    // Controls display order in the "generate docs" wizard — lower first.
    sortOrder: { type: Number, default: 0 },
    fields: [fieldSchema],
    loops: [loopSchema],
  },
  { timestamps: true }
);

module.exports = model('DocumentTemplate', documentTemplateSchema);
