const { Schema, model } = require('mongoose');

// Coordinates and size are stored as page-relative fractions (0-1, xPct/yPct
// measured from the top-left corner) rather than PDF points — this lets the
// frontend mapper UI calibrate a real resizable box by dragging on a
// rendered canvas of any size/zoom, and the backend converts to pdf-lib's
// bottom-left point space only at stamp time, fitting/centering whatever it
// draws inside the box rather than stamping at a bare point.
const positionSchema = new Schema(
  {
    page: { type: Number, required: true },
    xPct: { type: Number, required: true },
    yPct: { type: Number, required: true },
    widthPct: { type: Number, required: true },
    heightPct: { type: Number, required: true },
  },
  { _id: false }
);

const planOptionSchema = new Schema(
  { key: { type: String, required: true }, label: { type: String, required: true } },
  { _id: false }
);

// Scope-of-Work → recurring task structure, defined once per template (e.g.
// "GO-TO x DIAMOND") and reused for every client on that plan — see
// scopeOfWork.service.js. `steps` is the shared pipeline every item in the
// section goes through (e.g. Plan of Action → Shoot → Edit → Publish);
// `items` are the actual deliverables with how many are due per monthly
// cycle (e.g. "Number of Reels": 8).
const scopeStepSchema = new Schema(
  { label: { type: String, required: true }, order: { type: Number, required: true } },
  { _id: false }
);
const scopeItemSchema = new Schema(
  {
    label: { type: String, required: true },
    // Meaning depends on the template's planType (see taskCycle.service.js):
    // 'duration' templates (monthly retainers) -> literal count per month.
    // 'quantity' templates (podcast batches) -> count per single unit in the
    //   batch, multiplied by however many units the client's plan option
    //   selected (e.g. "4 podcasts" x 3 reels/podcast = 12 Reel tasks).
    // 'fixed' templates -> literal count for the one-off engagement.
    qtyPerCycle: { type: Number, required: true, min: 0 },
    // When true, qtyPerCycle is "count per day" and gets multiplied by the
    // number of days in the cycle instead of used as a flat total — for
    // deliverables like daily Stories that don't have a clean monthly count.
    // Only meaningful on 'recurring' (duration-type) cycles.
    perDay: { type: Boolean, default: false },
  },
  { _id: false }
);
const scopeSectionSchema = new Schema({
  name: { type: String, required: true },
  items: [scopeItemSchema],
  steps: [scopeStepSchema],
});

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
    scopeOfWork: [scopeSectionSchema],
  },
  { timestamps: true }
);

module.exports = model('QuotationTemplate', quotationTemplateSchema);
