require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const documentTemplateRepository = require('../src/repositories/documentTemplate.repository');

// Reused across templates so the wizard (M7) dedupes by field key when an
// admin generates multiple documents at once.
const employeeName = {
  key: 'employeeName', label: 'Employee full name', type: 'text', required: true,
  source: 'computed', group: 'Personal', order: 1,
};
const employeeAddress = {
  key: 'employeeAddress', label: 'Employee address', type: 'textarea', required: true,
  // Employee.address was split into permanentAddress/localAddress — this
  // still only pulls one line (permanentAddress.line1), same as before the
  // split; the full structured address isn't composed here.
  source: 'employee', mapsTo: 'permanentAddress.line1', group: 'Personal', order: 2,
};
const todayDate = {
  key: 'todayDate', label: "Today's date", type: 'date', required: true,
  source: 'computed', group: 'Meta', order: 99,
};
const designation = {
  key: 'designation', label: 'Designation', type: 'text', required: true,
  source: 'employee', mapsTo: 'designation', group: 'Employment', order: 10,
};
const department = {
  key: 'department', label: 'Department', type: 'text', required: false,
  source: 'employee', mapsTo: 'department', group: 'Employment', order: 11,
};
const dateOfJoining = {
  key: 'dateOfJoining', label: 'Date of joining', type: 'date', required: true,
  source: 'employee', mapsTo: 'dateOfJoining', group: 'Employment', order: 12,
};
const reportingManager = {
  key: 'reportingManager', label: 'Reporting manager', type: 'text', required: false,
  source: 'employee', mapsTo: 'reportingManager', group: 'Employment', order: 13,
};
const workLocation = {
  key: 'workLocation', label: 'Work location', type: 'text', required: true,
  source: 'employee', mapsTo: 'workLocation', group: 'Employment', order: 14,
};
const employmentType = {
  key: 'employmentType', label: 'Employment type', type: 'select', required: true,
  source: 'employee', mapsTo: 'employmentType', group: 'Employment', order: 15,
  options: ['full-time', 'part-time', 'contract', 'intern'],
};
const jobDescription = {
  key: 'jobDescription', label: 'Job description', type: 'textarea', required: true,
  source: 'manual', group: 'Job Details', order: 20,
  helpText: 'A short paragraph describing the role and responsibilities.',
};

// Computed purely from employee.salaryComponents — never shown in the wizard
// (source: 'computed' fields are always excluded from the admin-facing form),
// just resolved automatically at generation time.
const annualCTC = {
  key: 'annualCTC', label: 'Annual CTC', type: 'currency', required: true,
  source: 'computed', group: 'Compensation', order: 30,
};
const annualCTCInWords = {
  key: 'annualCTCInWords', label: 'Annual CTC (in words)', type: 'text', required: true,
  source: 'computed', group: 'Compensation', order: 31,
};
const lastWorkingDate = {
  key: 'lastWorkingDate', label: 'Last working date', type: 'date', required: true,
  source: 'manual', group: 'Offboarding Details', order: 40,
};
const tenureDuration = {
  key: 'tenureDuration', label: 'Tenure (e.g. "2 years 3 months")', type: 'text', required: true,
  source: 'manual', group: 'Relieving Details', order: 50,
};

const templates = [
  {
    key: 'appointment-letter',
    title: 'Letter of Appointment',
    description: 'Formal appointment letter with compensation structure, issued at onboarding.',
    category: 'onboarding',
    templateType: 'html',
    htmlFilePath: 'appointment-letter.html',
    fields: [
      employeeName, employeeAddress, designation, workLocation, jobDescription,
      dateOfJoining, annualCTC, annualCTCInWords, todayDate,
    ],
    // Explicit empty array, not just an absent key — findOneAndUpdate's
    // implicit $set on a plain object only sets keys that are present, so
    // omitting `loops` entirely would leave a stale salaryComponents loop
    // from a previous seed in place instead of clearing it.
    loops: [],
  },
  {
    key: 'offer-letter',
    title: 'Offer Letter',
    description: 'Extended to a candidate before they join, with compensation and key employment details.',
    category: 'onboarding',
    templateType: 'html',
    htmlFilePath: 'offer-letter.html',
    fields: [
      employeeName, designation, department, dateOfJoining, employmentType,
      workLocation, jobDescription, annualCTC,
    ],
    // Explicit empty array — see the appointment-letter entry above for why
    // this can't just be an absent key.
    loops: [],
  },
  {
    key: 'code-of-conduct',
    title: 'Code of Conduct',
    description: 'Workplace conduct policy acknowledgement.',
    category: 'compliance',
    templateType: 'html',
    htmlFilePath: 'code-of-conduct.html',
    fields: [employeeName],
    loops: [],
  },
  {
    key: 'nda',
    title: 'Non-Disclosure Agreement',
    description: 'Confidentiality agreement signed at onboarding.',
    category: 'compliance',
    templateType: 'html',
    htmlFilePath: 'nda.html',
    fields: [
      employeeName, employeeAddress,
      {
        key: 'effectiveDate', label: 'Agreement effective date', type: 'date', required: true,
        source: 'manual', group: 'Agreement Details', order: 41,
      },
    ],
    loops: [],
  },
  {
    key: 'hr-policies',
    title: 'HR Policies',
    description: 'General HR policy handbook acknowledgement.',
    category: 'policy',
    templateType: 'html',
    htmlFilePath: 'hr-policies.html',
    fields: [employeeName],
    loops: [],
  },
  {
    key: 'promotion-letter',
    title: 'Promotion Letter',
    description: 'Confirms a promotion, new designation, and revised compensation.',
    category: 'onboarding',
    templateType: 'html',
    htmlFilePath: 'promotion-letter.html',
    fields: [
      employeeName, designation, reportingManager, todayDate,
      {
        key: 'newDesignation', label: 'New designation', type: 'text', required: true,
        source: 'manual', group: 'Promotion Details', order: 42,
      },
      {
        key: 'promotionEffectiveDate', label: 'Promotion effective date', type: 'date', required: true,
        source: 'manual', group: 'Promotion Details', order: 43,
      },
      {
        key: 'achievementsSummary', label: 'Key achievements/responsibilities', type: 'textarea', required: true,
        source: 'manual', group: 'Promotion Details', order: 44,
      },
      {
        key: 'newAnnualCTC', label: 'New annual CTC', type: 'currency', required: true,
        source: 'manual', group: 'Promotion Details', order: 45,
      },
      {
        key: 'benefitsDetails', label: 'Benefits/allowances (if any)', type: 'text', required: false,
        source: 'manual', group: 'Promotion Details', order: 46,
      },
    ],
    // Variable-length list — only the responsibilities actually entered get
    // a bullet in the letter, and the admin can add as many as needed.
    loops: [
      {
        key: 'responsibilities',
        label: 'New responsibilities',
        itemFields: [{ key: 'text', label: 'Responsibility', type: 'text' }],
      },
    ],
  },
  {
    key: 'offboarding-letter',
    title: 'Offboarding Document',
    description: 'Checklist and instructions issued when an employee is leaving.',
    category: 'offboarding',
    templateType: 'html',
    htmlFilePath: 'offboarding-letter.html',
    fields: [
      employeeName, designation, todayDate, lastWorkingDate,
      {
        key: 'returnItemsTo', label: 'Return company property to', type: 'text', required: true,
        source: 'manual', group: 'Offboarding Details', order: 41,
      },
      {
        key: 'separationType', label: 'Separation type', type: 'select', required: true,
        source: 'manual', group: 'Offboarding Details', order: 42,
        options: ['Voluntary Resignation', 'Layoff', 'Termination'],
      },
      {
        key: 'reasonForLeaving', label: 'Reason for leaving', type: 'textarea', required: true,
        source: 'manual', group: 'Offboarding Details', order: 43,
      },
      {
        key: 'referenceContact', label: 'Future reference contact', type: 'text', required: false,
        source: 'manual', group: 'Offboarding Details', order: 44,
      },
      {
        key: 'farewellContactDetails', label: 'Farewell contact details (name / phone / email)', type: 'text', required: true,
        source: 'manual', group: 'Offboarding Details', order: 45,
      },
    ],
  },
  {
    key: 'relieving-letter',
    title: 'Relieving Letter',
    description: 'Formally accepts resignation and confirms relieving date.',
    category: 'offboarding',
    templateType: 'html',
    htmlFilePath: 'relieving-letter.html',
    fields: [
      employeeName, employeeAddress, designation, department, todayDate, lastWorkingDate, tenureDuration,
      {
        key: 'resignationDate', label: 'Resignation letter date', type: 'date', required: true,
        source: 'manual', group: 'Relieving Details', order: 51,
      },
      {
        key: 'assetsReturned', label: 'Assets returned (e.g. laptop, access card)', type: 'text', required: false,
        source: 'manual', group: 'Relieving Details', order: 52,
      },
    ],
  },
  {
    key: 'experience-letter',
    title: 'Experience Letter',
    description: 'Service certificate and professional reference.',
    category: 'offboarding',
    templateType: 'html',
    htmlFilePath: 'experience-letter.html',
    fields: [
      employeeName, designation, department, dateOfJoining, todayDate, lastWorkingDate, tenureDuration,
      {
        key: 'keyTrait', label: 'Key professional trait', type: 'text', required: true,
        source: 'manual', group: 'Experience Details', order: 60,
      },
      {
        key: 'specificProject', label: 'Specific process/project improved', type: 'text', required: false,
        source: 'manual', group: 'Experience Details', order: 61,
      },
      {
        key: 'positiveOutcome', label: 'Resulting positive outcome', type: 'text', required: false,
        source: 'manual', group: 'Experience Details', order: 62,
      },
    ],
  },
  {
    key: 'fnf-settlement',
    title: 'Full & Final Settlement Agreement',
    description: 'Separation and general release agreement with severance terms.',
    category: 'offboarding',
    templateType: 'html',
    htmlFilePath: 'fnf-settlement.html',
    fields: [
      employeeName, todayDate,
      {
        key: 'separationDate', label: 'Separation date', type: 'date', required: true,
        source: 'manual', group: 'Settlement Details', order: 70,
      },
      {
        key: 'accruedLeaveDays', label: 'Accrued leave days paid out', type: 'number', required: true,
        source: 'manual', group: 'Settlement Details', order: 71,
      },
      {
        key: 'severanceAmount', label: 'Severance amount', type: 'currency', required: true,
        source: 'manual', group: 'Settlement Details', order: 72,
      },
      {
        key: 'severancePaymentDays', label: 'Severance payment timeline (days)', type: 'number', required: true,
        source: 'manual', group: 'Settlement Details', order: 73,
      },
      {
        key: 'propertyReturnDate', label: 'Company property return date', type: 'date', required: true,
        source: 'manual', group: 'Settlement Details', order: 74,
      },
    ],
  },
  {
    key: 'hardware-consent-form',
    title: 'Hardware Usage & Consent Form',
    description: 'Equipment issuance record and usage/liability consent for company hardware and SIM.',
    category: 'compliance',
    templateType: 'html',
    htmlFilePath: 'hardware-consent-form.html',
    fields: [employeeName, designation, department, todayDate],
    loops: [],
  },
  {
    key: 'work-for-hire',
    title: 'Work For Hire Agreement',
    description: 'Assigns ownership of creative work product (video/design/photo) to the company.',
    category: 'compliance',
    templateType: 'html',
    htmlFilePath: 'work-for-hire.html',
    fields: [employeeName, todayDate],
    loops: [],
  },
  {
    key: 'video-consent-form',
    title: 'Video & Media Consent Agreement',
    description: 'Consent for the company to film, photograph, and use an employee’s likeness.',
    category: 'compliance',
    templateType: 'html',
    htmlFilePath: 'video-consent-form.html',
    fields: [employeeName, todayDate],
    loops: [],
  },
];

async function main() {
  await mongoose.connect(env.mongodbUri);

  const seededKeys = new Set(templates.map((t) => t.key));
  for (const [index, template] of templates.entries()) {
    // The array above is already in the intended wizard display order —
    // reflect that as an explicit sortOrder rather than relying on category/title.
    await documentTemplateRepository.upsertByKey(template.key, { ...template, sortOrder: index + 1 });
    console.log(`Seeded template: ${template.key} (sortOrder ${index + 1})`);
  }

  // Deactivate any previously-seeded templates that no longer exist in this list.
  const DocumentTemplate = require('../src/models/DocumentTemplate');
  const stale = await DocumentTemplate.find({ key: { $nin: [...seededKeys] }, isActive: true });
  for (const doc of stale) {
    doc.isActive = false;
    await doc.save();
    console.log(`Deactivated stale template: ${doc.key}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
