const { z } = require('zod');
const DOC_TYPES = require('../config/docTypes');

const DOC_TYPE_KEYS = DOC_TYPES.map((d) => d.key);

const idParam = z.object({ id: z.string().min(1) });
const tokenParam = z.object({ token: z.string().min(10) });
const accessCode = z.string().length(6);

const create = {
  params: idParam,
  body: z.object({
    requestedDocTypes: z.array(z.enum(DOC_TYPE_KEYS)).min(1),
    expiresInHours: z.coerce.number().int().positive().max(24 * 30).optional(),
  }),
};

const listForEmployee = { params: idParam };
const revoke = { params: idParam };
const verifyCode = { params: tokenParam, body: z.object({ code: accessCode }) };
const getPublicStatus = { params: tokenParam, query: z.object({ code: accessCode }) };
// multipart body — fields land as strings on req.body alongside req.files,
// so `code` is validated the same way a JSON body field would be.
const uploadDocuments = { params: tokenParam, body: z.object({ code: accessCode }) };

module.exports = { create, listForEmployee, revoke, verifyCode, getPublicStatus, uploadDocuments };
