const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });
const bodyLabel = z.object({ label: z.string().min(1) });

const create = { body: bodyLabel };
const update = { params: idParam, body: bodyLabel };
const remove = { params: idParam };

module.exports = { create, update, remove };
