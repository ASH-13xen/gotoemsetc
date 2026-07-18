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

const resumeSchema = new Schema(
  { url: String, publicId: String, originalFilename: String },
  { _id: false }
);

// Freeform performance markers HR/admin can drop on any date, any number —
// red for poor work, green for good work. Deliberately not tied to a
// specific incident/task record; just a lightweight running log shown on
// the employee's profile. Keeps its own _id (default) so a single flag can
// be individually removed.
const flagSchema = new Schema(
  {
    color: { type: String, enum: ['red', 'green'], required: true },
    note: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const employeeSchema = new Schema(
  {
    // Numeric-looking string, starting at 1001 — see
    // scripts/seedEmployeeCounter.js and employee.service.js.
    employeeCode: { type: String, unique: true, sparse: true },
    // The biometric device's enrollment PIN for this employee — admin-only
    // (see employee.service.js#updateEmployee), set manually since the PIN
    // is assigned on the physical device, not derivable from anything else.
    ecoId: { type: String, trim: true, unique: true, sparse: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    personalEmail: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    instagramId: { type: String, trim: true },
    permanentAddress: addressSchema,
    localAddress: addressSchema,
    dob: Date,
    bloodGroup: { type: String, trim: true },
    gender: String,
    fatherName: String,

    designation: { type: String, required: true, trim: true },
    department: String,
    dateOfJoining: Date,
    // Set when this record is created by hiring an applicant — the date the
    // hire decision was made, distinct from dateOfJoining (their actual
    // start date, which may be weeks later).
    dateOfHiring: Date,
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern'],
      default: 'full-time',
    },
    reportingManager: String,
    workLocation: String,
    // "HH:mm" 24h strings — drives the attendance classifier's arrival/
    // departure boundaries for this specific employee (see
    // attendanceClassifier.service.js). Defaults match the company-wide
    // shift; only the on-time cutoff and the normal/overtime split actually
    // move with these — the dead zones and half-day window stay fixed for
    // everyone regardless of an individual's configured shift.
    workingHoursStart: { type: String, trim: true, default: '09:30' },
    workingHoursEnd: { type: String, trim: true, default: '18:30' },
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

    // Onboarding checklist — plain manual checkboxes, ticked off by HR.
    biometricVerificationAdded: { type: Boolean, default: false },
    companyLoginAdded: { type: Boolean, default: false },
    officePhoneAdded: { type: Boolean, default: false },
    personalPhoneAdded: { type: Boolean, default: false },

    status: {
      type: String,
      enum: Object.values(EMPLOYEE_STATUS),
      default: EMPLOYEE_STATUS.DRAFT,
    },
    isDeleted: { type: Boolean, default: false },

    // Set when this employee record was auto-created by hiring an applicant.
    sourceApplicant: { type: Schema.Types.ObjectId, ref: 'Applicant' },

    // Everything below is carried over from the Applicant record at hire
    // time (see applicant.service.js#hireApplicant) — kept on the Employee
    // itself rather than only reachable via sourceApplicant, so the original
    // application context survives even if the Applicant record is ever
    // pruned.
    experienceLevel: { type: String, trim: true },
    hasLaptop: { type: Boolean },
    willingToRelocate: { type: Boolean },
    availability: { type: String, trim: true },
    howDidYouFindUs: { type: String, trim: true },
    whyJoinCompany: { type: String, trim: true },
    workStylePreference: { type: String, trim: true },
    whyHireYou: { type: String, trim: true },
    currentSalary: { type: String, trim: true },
    expectedSalary: { type: String, trim: true },
    resumes: [resumeSchema],
    // Why they were selected — filled in on the Hire dialog in Applicants,
    // copied here so it's visible on the employee record too.
    selectionNotes: String,

    flags: [flagSchema],
  },
  { timestamps: true }
);

employeeSchema.index({ firstName: 'text', lastName: 'text', personalEmail: 'text' });

module.exports = model('Employee', employeeSchema);
