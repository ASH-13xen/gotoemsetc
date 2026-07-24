const { z } = require('zod');
const DOC_TYPES = require('../config/docTypes');

const DOC_TYPE_KEYS = DOC_TYPES.map((d) => d.key);

const listForEmployee = { params: z.object({ id: z.string().min(1) }) };
const remove = { params: z.object({ id: z.string().min(1) }) };

const adminUpload = {
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      docType: z.enum(DOC_TYPE_KEYS),
      otherLabel: z.string().trim().min(1).optional(),
    })
    // multipart fields arrive as strings even for 'other', so this can't be
    // expressed as a discriminated union — checked by hand instead.
    .refine((data) => data.docType !== 'other' || Boolean(data.otherLabel), {
      message: 'otherLabel is required when docType is "other"',
      path: ['otherLabel'],
    }),
};

module.exports = { listForEmployee, remove, adminUpload };
