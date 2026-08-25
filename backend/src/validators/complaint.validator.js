const { z } = require('zod');
const { COMPLAINT_CATEGORY, COMPLAINT_STATUS } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const create = {
  body: z.object({
    category: z.enum(Object.values(COMPLAINT_CATEGORY)),
    description: z.string().min(1, 'Please describe the complaint'),
  }),
};

const list = {
  query: z.object({
    status: z.enum(Object.values(COMPLAINT_STATUS)).optional(),
  }),
};

const complete = { ...idParam };

const review = {
  params: idParam.params,
  body: z.object({
    speedRating: z.coerce.number().int().min(1).max(5),
    qualityRating: z.coerce.number().int().min(1).max(5),
    comments: z.string().trim().optional(),
  }),
};

module.exports = { create, list, complete, review };
