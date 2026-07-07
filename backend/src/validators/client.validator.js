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
  body: z.object({
    clientName: z.string().min(1).optional(),
    brandName: z.string().min(1).optional(),
    dateRegistered: z.coerce.date().optional(),
    status: statusEnum.optional(),
  }),
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
