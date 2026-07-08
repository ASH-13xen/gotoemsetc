const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });
const employeeIdParam = z.object({ employeeId: z.string().min(1) });

const getById = { params: idParam };

const getByEmployeeId = { params: employeeIdParam };

const createCredential = {
  params: employeeIdParam,
  body: z.object({
    username: z.string().min(3),
    password: z.string().min(6),
  }),
};

const updateCredential = {
  params: idParam,
  body: z.object({
    username: z.string().min(3).optional(),
    password: z.string().min(6).optional(),
  }),
};

const removeCredential = { params: idParam };

module.exports = { getById, getByEmployeeId, createCredential, updateCredential, removeCredential };
