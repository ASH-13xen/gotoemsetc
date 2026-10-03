const { z } = require('zod');
const { ORG_NODE_KIND, TEAM_MEMBER_ROLE } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const idParam = { params: z.object({ id: objectId }) };

const createNode = {
  body: z.object({
    title: z.string().trim().min(1, 'Give the box a title').max(80),
    description: z.string().trim().max(300).optional(),
    kind: z.enum(Object.values(ORG_NODE_KIND)).optional(),
    parent: objectId.nullable().optional(),
    workTeam: objectId.nullable().optional(),
    teamRole: z.enum(Object.values(TEAM_MEMBER_ROLE)).optional(),
    isTeamHead: z.boolean().optional(),
  }),
};

const updateNode = {
  ...idParam,
  body: z.object({
    title: z.string().trim().min(1, 'Give the box a title').max(80).optional(),
    description: z.string().trim().max(300).optional(),
    workTeam: objectId.nullable().optional(),
    teamRole: z.enum(Object.values(TEAM_MEMBER_ROLE)).optional(),
    isTeamHead: z.boolean().optional(),
  }),
};

const moveNode = {
  ...idParam,
  body: z.object({
    parent: objectId.optional(),
    order: z.number().int().min(0).optional(),
  }),
};

const deleteNode = {
  ...idParam,
  query: z.object({ mode: z.enum(['lift', 'branch']).optional() }),
};

const setAssignees = {
  ...idParam,
  body: z.object({ employeeIds: z.array(objectId).max(50) }),
};

module.exports = { createNode, updateNode, moveNode, deleteNode, setAssignees };
