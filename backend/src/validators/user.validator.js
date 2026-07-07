const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const getById = { params: idParam };

module.exports = { getById };
