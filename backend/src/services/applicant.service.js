const ApiError = require('../utils/ApiError');
const { APPLICANT_STATUS } = require('../config/constants');
const applicantRepository = require('../repositories/applicant.repository');
const interviewRepository = require('../repositories/interview.repository');
const employeeRepository = require('../repositories/employee.repository');
const employeeService = require('./employee.service');
const cloudinaryUploadService = require('./cloudinaryUpload.service');
const activityService = require('./activity.service');

async function listApplicants(params) {
  return applicantRepository.list(params);
}

async function getApplicant(id) {
  const applicant = await applicantRepository.findById(id);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  const activeInterview = await interviewRepository.findActiveByApplicant(id);
  return { applicant, activeInterview };
}

// Accepts an array of { buffer, originalname, mimetype } — multer files from
// the manual-add form, or base64-decoded buffers from the Google Form
// webhook. Uploaded one at a time (resumes are rare enough that parallel
// upload isn't worth the complexity) onto the applicant's own Cloudinary
// folder.
async function createApplicant(data, resumeFiles = []) {
  const applicant = await applicantRepository.create(data);
  if (!resumeFiles.length) return applicant;

  const resumes = [];
  for (const file of resumeFiles) {
    const ext = cloudinaryUploadService.extensionFor(file.originalname, file.mimetype);
    const upload = await cloudinaryUploadService.uploadBuffer(file.buffer, {
      folder: `ems/applicants/${applicant._id}/resume`,
      publicId: `resume-${Date.now()}-${resumes.length}${ext}`,
      resourceType: 'raw',
    });
    resumes.push({
      url: upload.secure_url,
      publicId: upload.public_id,
      originalFilename: file.originalname,
    });
  }

  return applicantRepository.updateById(applicant._id, { resumes });
}

async function updateApplicant(id, data) {
  const applicant = await applicantRepository.updateById(id, data);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  return applicant;
}

async function deleteApplicant(id) {
  const applicant = await applicantRepository.softDeleteById(id);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  return applicant;
}

function assertReadyForDecision(applicant) {
  if (applicant.status === APPLICANT_STATUS.HIRED) {
    throw ApiError.conflict('This applicant has already been hired');
  }
  if (applicant.status === APPLICANT_STATUS.REJECTED) {
    throw ApiError.conflict('This applicant has already been rejected');
  }
  if (applicant.status !== APPLICANT_STATUS.INTERVIEW_SCHEDULED) {
    throw ApiError.badRequest('Schedule and complete an interview before making a decision on this applicant');
  }
}

// Hiring creates a real Employee record pre-filled from the application, so
// the admin drops straight into the same onboarding/document-generation flow
// used for any other employee — no separate "recruit onboarding" feature.
// Telling the applicant is a manual step handled entirely by the frontend
// (Send Email/Send WhatsApp buttons) — nothing here contacts them.
async function hireApplicant(id, { selectionNotes, decisionDate, startDate }) {
  const applicant = await applicantRepository.findById(id);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  assertReadyForDecision(applicant);

  const employee = await employeeService.createEmployee({
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    personalEmail: applicant.email,
    phone: applicant.phone,
    instagramId: applicant.instagramId,
    designation: applicant.positionAppliedFor || 'TBD',
    dateOfJoining: startDate,
    dateOfHiring: decisionDate,
    // Everything below is carried over from the application so it isn't
    // only reachable via sourceApplicant — see Employee.js for why.
    experienceLevel: applicant.experienceLevel,
    hasLaptop: applicant.hasLaptop,
    willingToRelocate: applicant.willingToRelocate,
    availability: applicant.availability,
    howDidYouFindUs: applicant.howDidYouFindUs,
    whyJoinCompany: applicant.whyJoinCompany,
    workStylePreference: applicant.workStylePreference,
    whyHireYou: applicant.whyHireYou,
    currentSalary: applicant.currentSalary,
    expectedSalary: applicant.expectedSalary,
    resumes: applicant.resumes,
    selectionNotes,
  });
  await employeeRepository.updateById(employee._id, { sourceApplicant: applicant._id });

  const updatedApplicant = await applicantRepository.updateById(id, {
    status: APPLICANT_STATUS.HIRED,
    decisionDate,
    selectionNotes,
    linkedEmployee: employee._id,
  });

  await activityService.log(employee._id, 'EMPLOYEE_CREATED_FROM_APPLICANT', {
    applicantId: applicant._id.toString(),
    applicantName: `${applicant.firstName} ${applicant.lastName || ''}`.trim(),
  });

  return { applicant: updatedApplicant, employee };
}

async function rejectApplicant(id, { rejectionReason, decisionDate }) {
  const applicant = await applicantRepository.findById(id);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  assertReadyForDecision(applicant);

  const updatedApplicant = await applicantRepository.updateById(id, {
    status: APPLICANT_STATUS.REJECTED,
    rejectionReason,
    decisionDate,
  });

  return updatedApplicant;
}

module.exports = {
  listApplicants,
  getApplicant,
  createApplicant,
  updateApplicant,
  deleteApplicant,
  hireApplicant,
  rejectApplicant,
};
