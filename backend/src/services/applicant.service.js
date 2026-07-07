const ApiError = require('../utils/ApiError');
const { APPLICANT_STATUS } = require('../config/constants');
const applicantRepository = require('../repositories/applicant.repository');
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
  return applicant;
}

async function createApplicant(data, resumeFile) {
  const applicant = await applicantRepository.create(data);
  if (!resumeFile) return applicant;

  const ext = cloudinaryUploadService.extensionFor(resumeFile.originalname, resumeFile.mimetype);
  const upload = await cloudinaryUploadService.uploadBuffer(resumeFile.buffer, {
    folder: `ems/applicants/${applicant._id}/resume`,
    publicId: `resume-${Date.now()}${ext}`,
    resourceType: 'raw',
  });

  return applicantRepository.updateById(applicant._id, {
    resume: {
      url: upload.secure_url,
      publicId: upload.public_id,
      originalFilename: resumeFile.originalname,
    },
  });
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

// Hiring creates a real Employee record pre-filled from the application, so
// the admin drops straight into the same onboarding/document-generation flow
// used for any other employee — no separate "recruit onboarding" feature.
async function hireApplicant(id, { selectionNotes, decisionDate }) {
  const applicant = await applicantRepository.findById(id);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  if (applicant.status === APPLICANT_STATUS.HIRED) {
    throw ApiError.conflict('This applicant has already been hired');
  }

  const employee = await employeeService.createEmployee({
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    personalEmail: applicant.email,
    phone: applicant.phone,
    designation: applicant.positionAppliedFor || 'TBD',
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
  const applicant = await applicantRepository.updateById(id, {
    status: APPLICANT_STATUS.REJECTED,
    rejectionReason,
    decisionDate,
  });
  if (!applicant) throw ApiError.notFound('Applicant not found');
  return applicant;
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
