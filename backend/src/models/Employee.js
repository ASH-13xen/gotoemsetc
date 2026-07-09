const { Schema, model } = require('mongoose');
const { EMPLOYEE_STATUS } = require('../config/constants');

const addressSchema = new Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },
  { _id: false }
);

const salaryComponentSchema = new Schema(
  { label: { type: String, required: true }, monthlyAmount: { type: Number, required: true } },
  { _id: false }
);

// Freeform key/value pairs, similar to an env var editor — lets HR record
// anything that doesn't have a dedicated field without a schema change.
const extraDetailSchema = new Schema(
  { key: { type: String, required: true, trim: true }, value: { type: String, trim: true } },
  { _id: false }
);

const employeeSchema = new Schema(
  {
    employeeCode: { type: String, unique: true, sparse: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    personalEmail: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    instagramId: { type: String, trim: true },
    address: addressSchema,
    dob: Date,
    gender: String,
    fatherName: String,

    designation: { type: String, required: true, trim: true },
    department: String,
    dateOfJoining: Date,
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern'],
      default: 'full-time',
    },
    reportingManager: String,
    workLocation: String,
    ctcAnnual: Number,
    monthlyPay: Number,
    // Itemized monthly breakup (Basic, HRA, etc.) — ctcAnnual above is kept as
    // a simple summary field, this drives the detailed salary table in letters.
    salaryComponents: [salaryComponentSchema],
    bankAccountNumber: String,
    bankIFSC: String,
    bankName: String,
    // Day of month (1-31) salary is normally paid — combined with a salary
    // slip's target month/year at generation time to print the actual date.
    payDate: Number,
    panNumber: String,
    aadharNumber: String,
    extraDetails: [extraDetailSchema],

    status: {
      type: String,
      enum: Object.values(EMPLOYEE_STATUS),
      default: EMPLOYEE_STATUS.DRAFT,
    },
    isDeleted: { type: Boolean, default: false },

    // Set when this employee record was auto-created by hiring an applicant.
    sourceApplicant: { type: Schema.Types.ObjectId, ref: 'Applicant' },
  },
  { timestamps: true }
);

employeeSchema.index({ firstName: 'text', lastName: 'text', personalEmail: 'text' });

module.exports = model('Employee', employeeSchema);
