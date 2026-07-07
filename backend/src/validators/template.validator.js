const { z } = require('zod');

const list = {
  query: z.object({
    active: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  }),
};

const getById = {
  params: z.object({ id: z.string().min(1) }),
};

module.exports = { list, getById };
