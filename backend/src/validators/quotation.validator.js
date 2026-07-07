const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });
const tokenParam = z.object({ token: z.string().min(1) });

const generate = {
  params: idParam,
  body: z.object({
    templateId: z.string().min(1),
    planOptionKey: z.string().optional(),
  }),
};

const listForClient = { params: idParam };

const adminSign = {
  params: idParam,
  body: z.object({ signatureDataUrl: z.string().min(1) }),
};

const getFile = {
  params: z.object({ id: z.string().min(1), variant: z.enum(['draft', 'admin-signed', 'final']) }),
};

const getPublic = { params: tokenParam };

const signPublic = {
  params: tokenParam,
  body: z.object({ signatureDataUrl: z.string().min(1) }),
};

module.exports = { generate, listForClient, adminSign, getFile, getPublic, signPublic };
