const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });
const noteIdParam = z.object({ id: z.string().min(1), noteId: z.string().min(1) });

const create = {
  params: idParam,
  body: z.object({ body: z.string().min(1) }),
};

const listForClient = { params: idParam };

const remove = { params: noteIdParam };

module.exports = { create, listForClient, remove };
