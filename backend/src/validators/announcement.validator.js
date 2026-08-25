const { z } = require('zod');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const create = {
  body: z
    .object({
      title: z.string().trim().min(1, 'Title is required'),
      message: z.string().trim().min(1, 'Message is required'),
      sendToAll: z.boolean().optional(),
      employeeIds: z.array(z.string().min(1)).optional(),
    })
    .refine((data) => data.sendToAll || (data.employeeIds && data.employeeIds.length > 0), {
      message: 'Select at least one employee, or send to everyone',
      path: ['employeeIds'],
    }),
};

const acknowledge = { ...idParam };

module.exports = { create, acknowledge };
