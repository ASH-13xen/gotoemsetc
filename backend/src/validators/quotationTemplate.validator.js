const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const positionSchema = z.object({
  page: z.coerce.number().int().min(0),
  xPct: z.coerce.number().min(0).max(1),
  yPct: z.coerce.number().min(0).max(1),
  widthPct: z.coerce.number().min(0).max(1),
  heightPct: z.coerce.number().min(0).max(1),
});

const getOrPdf = { params: idParam };

const updateFields = {
  params: idParam,
  body: z.object({
    clientName: positionSchema.optional(),
    brandName: positionSchema.optional(),
    date: positionSchema.optional(),
    // Admins may calibrate checkboxes out of order (e.g. the 3rd plan option
    // before the 1st) — JSON has no `undefined`, so unplaced slots arrive as
    // `null` holes in the array until every slot is eventually filled in.
    planCheckboxes: z.array(positionSchema.nullable()).optional(),
    totalPayableAmount: positionSchema.optional(),
    shootDate: positionSchema.optional(),
    adminSignature: positionSchema.optional(),
    clientSignature: positionSchema.optional(),
  }),
};

module.exports = { getOrPdf, updateFields };
