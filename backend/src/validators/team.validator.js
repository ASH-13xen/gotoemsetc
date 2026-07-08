const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });
const membersArray = z.array(z.string().min(1));

const create = {
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    members: membersArray.optional(),
    leader: z.string().min(1).optional(),
  }),
};

const update = {
  params: idParam,
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    members: membersArray.optional(),
    leader: z.string().min(1).nullable().optional(),
  }),
};

const getOrDelete = { params: idParam };

module.exports = { create, update, getOrDelete };
