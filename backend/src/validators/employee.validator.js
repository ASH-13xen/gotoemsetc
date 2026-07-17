const { z } = require('zod');
const { BLOOD_GROUPS } = require('../config/constants');

const addressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().optional(),
  })
  .partial();

const employmentTypeEnum = z.enum(['full-time', 'part-time', 'contract', 'intern']);
const statusEnum = z.enum(['draft', 'active', 'offboarded']);

const salaryComponentSchema = z.object({
  label: z.string().min(1),
  monthlyAmount: z.coerce.number(),
});

const extraDetailSchema = z.object({
  key: z.string().min(1),
  value: z.string().optional(),
});

const mutableFields = {
  // Admin-only — see employee.service.js#updateEmployee, which strips this
  // from the payload for non-admin callers regardless of what's sent here.
  ecoId: z.string().trim().min(1).optional(),

  firstName: z.string().min(1),
  lastName: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  instagramId: z.string().optional(),
  permanentAddress: addressSchema.optional(),
  localAddress: addressSchema.optional(),
  dob: z.coerce.date().optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  gender: z.string().optional(),
  fatherName: z.string().optional(),

  designation: z.string().min(1),
  department: z.string().optional(),
  dateOfJoining: z.coerce.date().optional(),
  dateOfHiring: z.coerce.date().optional(),
  employmentType: employmentTypeEnum.optional(),
  reportingManager: z.string().optional(),
  workLocation: z.string().optional(),
  ctcAnnual: z.coerce.number().optional(),
  monthlyPay: z.coerce.number().optional(),
  salaryComponents: z.array(salaryComponentSchema).optional(),
  bankAccountNumber: z.string().optional(),
  bankIFSC: z.string().optional(),
  bankName: z.string().optional(),
  payDate: z.coerce.number().int().min(1).max(31).optional(),
  panNumber: z.string().optional(),
  aadharNumber: z.string().optional(),
  extraDetails: z.array(extraDetailSchema).optional(),

  // Onboarding checklist.
  biometricVerificationAdded: z.boolean().optional(),
  companyLoginAdded: z.boolean().optional(),
  officePhoneAdded: z.boolean().optional(),
  personalPhoneAdded: z.boolean().optional(),

  // Carried over from the application at hire time — editable here too in
  // case HR needs to correct something after the fact.
  experienceLevel: z.string().optional(),
  hasLaptop: z.boolean().optional(),
  willingToRelocate: z.boolean().optional(),
  availability: z.string().optional(),
  howDidYouFindUs: z.string().optional(),
  whyJoinCompany: z.string().optional(),
  workStylePreference: z.string().optional(),
  whyHireYou: z.string().optional(),
  currentSalary: z.string().optional(),
  expectedSalary: z.string().optional(),
  selectionNotes: z.string().optional(),

  status: statusEnum.optional(),
};

const idParam = { params: z.object({ id: z.string().min(1) }) };

const create = {
  body: z.object(mutableFields).pick({
    firstName: true,
    lastName: true,
    personalEmail: true,
    phone: true,
    instagramId: true,
    permanentAddress: true,
    localAddress: true,
    dob: true,
    bloodGroup: true,
    gender: true,
    fatherName: true,
    designation: true,
    department: true,
    dateOfJoining: true,
    dateOfHiring: true,
    employmentType: true,
    reportingManager: true,
    workLocation: true,
    ctcAnnual: true,
    monthlyPay: true,
    bankAccountNumber: true,
    bankIFSC: true,
    bankName: true,
    payDate: true,
    panNumber: true,
    aadharNumber: true,
    extraDetails: true,
    biometricVerificationAdded: true,
    companyLoginAdded: true,
    officePhoneAdded: true,
    personalPhoneAdded: true,
  }),
};

const update = {
  ...idParam,
  body: z.object(mutableFields).partial(),
};

const getOrDelete = { ...idParam };

const list = {
  query: z.object({
    search: z.string().optional(),
    status: statusEnum.optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

module.exports = { create, update, getOrDelete, list };
