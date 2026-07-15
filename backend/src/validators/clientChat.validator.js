const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const listMessages = { params: idParam };
const postMessage = { params: idParam, body: z.object({ body: z.string().min(1) }) };
const updateChatAccess = {
  params: idParam,
  body: z.object({ chatAllowedEmployees: z.array(z.string().min(1)) }),
};

module.exports = { listMessages, postMessage, updateChatAccess };
