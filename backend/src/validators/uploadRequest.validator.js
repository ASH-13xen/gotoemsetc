const { z } = require('zod');
const DOC_TYPES = require('../config/docTypes');

const DOC_TYPE_KEYS = DOC_TYPES.map((d) => d.key);

const idParam = z.object({ id: z.string().min(1) });
const tokenParam = z.object({ token: z.string().min(10) });

const create = {
  params: idParam,
  body: z.object({
    requestedDocTypes: z.array(z.enum(DOC_TYPE_KEYS)).min(1),
    expiresInHours: z.coerce.number().int().positive().max(24 * 30).optional(),
  }),
};

const listForEmployee = { params: idParam };
const revoke = { params: idParam };
const getPublicStatus = { params: tokenParam };
const uploadDocuments = { params: tokenParam };

module.exports = { create, listForEmployee, revoke, getPublicStatus, uploadDocuments };
