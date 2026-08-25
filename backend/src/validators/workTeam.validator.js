const { z } = require('zod');
const { TEAM_MEMBER_ROLE } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const memberRole = z.object({
  employee: z.string().min(1),
  roles: z.array(z.enum(Object.values(TEAM_MEMBER_ROLE))).optional(),
});

const mutableFields = {
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  leader: z.string().min(1),
  members: z.array(z.string().min(1)).optional(),
  memberRoles: z.array(memberRole).optional(),
  isTemporary: z.boolean().optional(),
};

const create = { body: z.object(mutableFields) };
const update = { ...idParam, body: z.object(mutableFields).partial() };
const getOrDelete = { ...idParam };

module.exports = { create, update, getOrDelete };
