const { Schema, model } = require('mongoose');

// Coordinates are stored as page-relative fractions (0-1, measured from the
// top-left corner) rather than PDF points — this lets the frontend mapper UI
// calibrate positions by clicking on a rendered canvas of any size/zoom, and
// the backend converts to pdf-lib's bottom-left point space only at stamp time.
const positionSchema = new Schema(
  { page: { type: Number, required: true }, xPct: { type: Number, required: true }, yPct: { type: Number, required: true } },
  { _id: false }
);

const planOptionSchema = new Schema(
  { key: { type: String, required: true }, label: { type: String, required: true } },
  { _id: false }
);

const quotationTemplateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    companyLabel: { type: String, required: true },
    pdfFilename: { type: String, required: true },
    pageCount: { type: Number, required: true },
    // 'duration' = 1/3/6/12 month checkboxes, 'quantity' = 1/2/4/8 podcast
    // checkboxes, 'fixed' = single flat price, no plan selection at all.
    planType: { type: String, enum: ['duration', 'quantity', 'fixed'], required: true },
    planOptions: [planOptionSchema],
    hasBrandName: { type: Boolean, default: true },
    // The two RP templates greet "Name & Brand" as a single blank rather than
    // separate Client Name / Brand Name lines.
    combinedNameBrand: { type: Boolean, default: false },
    hasDateField: { type: Boolean, default: false },
    fixedAmount: { type: Number },
    fields: {
      clientName: positionSchema,
      brandName: positionSchema,
      date: positionSchema,
      // Plain Mixed rather than a typed subdocument array — admins can
      // calibrate the 4 plan checkboxes out of order, leaving `null` holes
      // at not-yet-placed indexes, which a strictly-typed subdocument array
      // would reject during casting.
      planCheckboxes: { type: [Schema.Types.Mixed], default: undefined },
      totalPayableAmount: positionSchema,
      shootDate: positionSchema,
      adminSignature: positionSchema,
      clientSignature: positionSchema,
    },
    isConfigured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('QuotationTemplate', quotationTemplateSchema);
