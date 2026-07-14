const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });
const tokenParam = z.object({ token: z.string().min(10) });
const accessCode = z.string().length(6);

const create = {
  params: idParam,
  body: z.object({
    requestedDocTypes: z.array(z.string().min(1)).min(1),
    expiresInHours: z.coerce.number().int().positive().max(24 * 30).optional(),
  }),
};

const listForClient = { params: idParam };
const revoke = { params: idParam };

const verifyCode = { params: tokenParam, body: z.object({ code: accessCode }) };
const getPublicStatus = { params: tokenParam, query: z.object({ code: accessCode }) };
const uploadDocuments = { params: tokenParam, body: z.object({ code: accessCode }) };

module.exports = { create, listForClient, revoke, verifyCode, getPublicStatus, uploadDocuments };
