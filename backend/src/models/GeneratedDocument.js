const { Schema, model } = require('mongoose');
const { GENERATED_DOCUMENT_STATUS } = require('../config/constants');

const fileRefSchema = new Schema(
  { url: String, publicId: String, bytes: Number },
  { _id: false }
);

const generatedDocumentSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    template: { type: Schema.Types.ObjectId, ref: 'DocumentTemplate', required: true },
    templateVersion: Number,
    mergeDataSnapshot: Schema.Types.Mixed,
    docx: fileRefSchema,
    pdf: fileRefSchema,
    status: {
      type: String,
      enum: Object.values(GENERATED_DOCUMENT_STATUS),
      default: GENERATED_DOCUMENT_STATUS.COMPLETED,
    },
    errorMessage: String,
  },
  { timestamps: true }
);

module.exports = model('GeneratedDocument', generatedDocumentSchema);
