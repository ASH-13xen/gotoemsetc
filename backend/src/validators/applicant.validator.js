const { z } = require('zod');
const {
  APPLICANT_STATUS,
  EXPERIENCE_LEVELS,
  AVAILABILITY_OPTIONS,
  WORK_STYLE_OPTIONS,
} = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });

// Multipart form fields arrive as strings — booleans/enums need coercion
// rather than plain z.boolean()/z.enum(), same reason dateApplied uses
// z.coerce.date().
const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : v))
  .optional();

const baseFields = {
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  instagramId: z.string().optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  hasLaptop: boolFromString,
  willingToRelocate: boolFromString,
  positionAppliedFor: z.string().optional(),
  availability: z.enum(AVAILABILITY_OPTIONS).optional(),
  howDidYouFindUs: z.string().optional(),
  whyJoinCompany: z.string().optional(),
  workStylePreference: z.enum(WORK_STYLE_OPTIONS).optional(),
  whyHireYou: z.string().optional(),
  currentSalary: z.string().optional(),
  expectedSalary: z.string().optional(),
};

const create = {
  body: z.object({
    ...baseFields,
    dateApplied: z.coerce.date(),
  }),
};

const update = {
  params: idParam,
  body: z.object({
    ...baseFields,
    firstName: z.string().min(1).optional(),
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
    startDate: z.coerce.date(),
    hiredPosition: z.string().optional(),
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
