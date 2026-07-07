const { z } = require('zod');

const login = {
  body: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),
};

module.exports = { login };
