const { z } = require('zod');
const { CLIENT_STATUS } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });
const statusEnum = z.enum(Object.values(CLIENT_STATUS));

const contactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

const register = {
  body: z.object({
    clientName: z.string().min(1),
    brandName: z.string().min(1),
    dateRegistered: z.coerce.date(),
  }),
};

const update = {
  params: idParam,
  body: z
    .object({
      clientName: z.string().min(1).optional(),
      brandName: z.string().min(1).optional(),
      dateRegistered: z.coerce.date().optional(),
      status: statusEnum.optional(),
      assignedTeam: z.string().min(1).nullable().optional(),
      assignedEmployees: z.array(z.string().min(1)).optional(),
      mainEmployee: z.string().min(1).nullable().optional(),
    })
    // The point of accountability has to actually be one of the people
    // assigned — can't name someone answerable who isn't even on the client.
    .refine(
      (data) =>
        !data.mainEmployee ||
        !data.assignedEmployees ||
        data.assignedEmployees.includes(data.mainEmployee),
      { message: 'mainEmployee must be one of assignedEmployees', path: ['mainEmployee'] }
    ),
};

const getOrDelete = { params: idParam };

const list = {
  query: z.object({
    search: z.string().optional(),
    status: statusEnum.optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const addContact = {
  params: idParam,
  body: contactSchema,
};

const removeContact = {
  params: z.object({ id: z.string().min(1), contactId: z.string().min(1) }),
};

module.exports = { register, update, getOrDelete, list, addContact, removeContact };
