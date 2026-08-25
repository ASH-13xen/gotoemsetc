const { z } = require('zod');
const { CMS_PLAN } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const contact = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().optional(),
  email: z.union([z.string().trim().email(), z.literal('')]).optional(),
  phone: z.string().trim().optional(),
  isPrimary: z.boolean().optional(),
});

const location = z.object({
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
});

const mutableFields = {
  name: z.string().trim().min(1),
  brandName: z.string().trim().optional(),
  defaultTeam: z.string().min(1).optional().nullable(),
  contacts: z.array(contact).optional(),
  location: location.optional(),
  instagramHandle: z.string().trim().optional(),
  website: z.string().trim().optional(),
  // The client manual's page 2/page 1 long-form fields — no length cap.
  aboutBrand: z.string().trim().optional(),
  aboutClient: z.string().trim().optional(),
  expectations: z.string().trim().optional(),
  // Nullable so a plan can be cleared, not only switched.
  currentPlan: z.enum(Object.values(CMS_PLAN)).optional().nullable(),
};

// Only `name` is required to register — brand, contacts, location, and the
// plan are all fillable later, matching how a client is actually onboarded.
const create = { body: z.object(mutableFields).partial().required({ name: true }) };
const update = { ...idParam, body: z.object(mutableFields).partial() };
const getOrDelete = { ...idParam };

module.exports = { create, update, getOrDelete };
