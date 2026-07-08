const { z } = require('zod');

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
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: addressSchema.optional(),
  dob: z.coerce.date().optional(),
  gender: z.string().optional(),
  fatherName: z.string().optional(),

  designation: z.string().min(1),
  department: z.string().optional(),
  dateOfJoining: z.coerce.date().optional(),
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

  status: statusEnum.optional(),
};

const idParam = { params: z.object({ id: z.string().min(1) }) };

const create = {
  body: z.object(mutableFields).pick({
    firstName: true,
    lastName: true,
    personalEmail: true,
    phone: true,
    address: true,
    dob: true,
    gender: true,
    fatherName: true,
    designation: true,
    department: true,
    dateOfJoining: true,
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
