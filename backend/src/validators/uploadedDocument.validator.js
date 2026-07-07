const { z } = require('zod');

const listForEmployee = { params: z.object({ id: z.string().min(1) }) };
const remove = { params: z.object({ id: z.string().min(1) }) };

module.exports = { listForEmployee, remove };
