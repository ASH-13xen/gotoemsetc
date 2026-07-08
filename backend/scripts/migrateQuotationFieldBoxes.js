require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const QuotationTemplate = require('../src/models/QuotationTemplate');

// One-off: positionSchema gained widthPct/heightPct (a real box instead of a
// bare point). Only `go-to-diamond` has real calibration data today — this
// backfills a default box size, anchored at the existing xPct/yPct as the
// top-left corner, so old data doesn't fail validation. These are guesses;
// re-drawing them with the new mapper's drag tool will look better.
const DEFAULT_SIZE = {
  clientName: { widthPct: 0.14, heightPct: 0.03 },
  brandName: { widthPct: 0.14, heightPct: 0.03 },
  date: { widthPct: 0.14, heightPct: 0.03 },
  totalPayableAmount: { widthPct: 0.14, heightPct: 0.03 },
  shootDate: { widthPct: 0.14, heightPct: 0.03 },
  planCheckboxes: { widthPct: 0.04, heightPct: 0.03 },
  adminSignature: { widthPct: 0.12, heightPct: 0.05 },
  clientSignature: { widthPct: 0.12, heightPct: 0.05 },
};

function withDefaultSize(position, key) {
  if (!position) return position;
  const size = DEFAULT_SIZE[key];
  return { ...position, widthPct: size.widthPct, heightPct: size.heightPct };
}

async function main() {
  await mongoose.connect(env.mongodbUri);

  const templates = await QuotationTemplate.find({});
  for (const template of templates) {
    const fields = template.fields.toObject();
    let changed = false;

    for (const key of ['clientName', 'brandName', 'date', 'totalPayableAmount', 'shootDate', 'adminSignature', 'clientSignature']) {
      if (fields[key] && fields[key].widthPct === undefined) {
        fields[key] = withDefaultSize(fields[key], key);
        changed = true;
      }
    }

    if (Array.isArray(fields.planCheckboxes) && fields.planCheckboxes.some((pos) => pos && pos.widthPct === undefined)) {
      fields.planCheckboxes = fields.planCheckboxes.map((pos) =>
        pos && pos.widthPct === undefined ? withDefaultSize(pos, 'planCheckboxes') : pos
      );
      changed = true;
    }

    if (changed) {
      await QuotationTemplate.updateOne({ _id: template._id }, { $set: { fields } });
      console.log(`Migrated: ${template.key}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
