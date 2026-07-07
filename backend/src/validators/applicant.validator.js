const { z } = require('zod');
const { APPLICANT_STATUS } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });

const create = {
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    positionAppliedFor: z.string().optional(),
    dateApplied: z.coerce.date(),
  }),
};

const update = {
  params: idParam,
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    positionAppliedFor: z.string().optional(),
    dateApplied: z.coerce.date().optional(),
  }),
};

const getOrDelete = { params: idParam };

const list = {
  query: z.object({
    search: z.string().optional(),
    status: z.enum(Object.values(APPLICANT_STATUS)).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const hire = {
  params: idParam,
  body: z.object({
    selectionNotes: z.string().min(1, 'Please note why this applicant was selected'),
    decisionDate: z.coerce.date(),
  }),
};

const reject = {
  params: idParam,
  body: z.object({
    rejectionReason: z.string().min(1, 'Please provide a rejection reason'),
    decisionDate: z.coerce.date(),
  }),
};

module.exports = { create, update, getOrDelete, list, hire, reject };
