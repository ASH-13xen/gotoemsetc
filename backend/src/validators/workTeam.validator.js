const { z } = require('zod');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const mutableFields = {
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  leader: z.string().min(1),
  members: z.array(z.string().min(1)).optional(),
};

const create = { body: z.object(mutableFields) };
const update = { ...idParam, body: z.object(mutableFields).partial() };
const getOrDelete = { ...idParam };

module.exports = { create, update, getOrDelete };
