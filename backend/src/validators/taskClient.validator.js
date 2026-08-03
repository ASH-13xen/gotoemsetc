const { z } = require('zod');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const mutableFields = {
  name: z.string().trim().min(1),
  defaultTeam: z.string().min(1).optional().nullable(),
};

const create = { body: z.object(mutableFields) };
const update = { ...idParam, body: z.object(mutableFields).partial() };
const getOrDelete = { ...idParam };

module.exports = { create, update, getOrDelete };
