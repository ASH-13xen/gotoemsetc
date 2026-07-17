const ApiError = require('../utils/ApiError');
const { APPLICANT_STATUS } = require('../config/constants');
const applicantRepository = require('../repositories/applicant.repository');
const interviewRepository = require('../repositories/interview.repository');
const employeeRepository = require('../repositories/employee.repository');
const employeeService = require('./employee.service');
const cloudinaryUploadService = require('./cloudinaryUpload.service');
const activityService = require('./activity.service');
const emailService = require('./email.service');
const env = require('../config/env');
const logger = require('../utils/logger');

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

// Sent to the applicant directly, plus a copy to the HR inbox — via Resend,
// fire-and-forget, same pattern as sendInterviewEmails.
async function sendHireEmail(applicant, employee) {
  const applicantName = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
  const position = employee.designation || 'the role';
  const startDate = employee.dateOfJoining
    ? new Date(employee.dateOfJoining).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'your start date';

  const subject = `Welcome to ${env.companyName} — ${position}`;
  const bodyLine = `Congratulations! We're delighted to confirm you've been selected for the ${position} role. Your start date is ${startDate}.`;

  const sends = [];
  if (applicant.email) {
    sends.push(
      emailService.sendEmail({
        to: applicant.email,
        subject,
        html: `<p>Hi ${applicantName},</p><p>${bodyLine}</p><p>Our HR team will follow up shortly with onboarding details.</p><p>Welcome aboard,<br/>${env.companyName} HR</p>`,
      })
    );
  }
  if (env.hrNotificationEmail) {
    sends.push(
      emailService.sendEmail({
        to: env.hrNotificationEmail,
        subject: `[Copy] ${subject} — ${applicantName}`,
        html: `<p>${bodyLine}</p><p>Applicant: ${applicantName} (${applicant.email || 'no email on file'}, ${applicant.phone || 'no phone on file'})</p>`,
      })
    );
  }

  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === 'rejected') logger.error({ err: result.reason }, 'Hire email send failed');
  }
}

// Rejection reason stays internal — the HR copy gets the full reason for the
// record, the applicant gets a generic, tactful decline.
async function sendRejectEmail(applicant, rejectionReason) {
  const applicantName = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
  const position = applicant.positionAppliedFor || 'the role';
  const subject = `Application update — ${position}`;

  const sends = [];
  if (applicant.email) {
    sends.push(
      emailService.sendEmail({
        to: applicant.email,
        subject,
        html: `<p>Hi ${applicantName},</p><p>Thank you for taking the time to apply for ${position} and for interviewing with us. After careful consideration, we've decided to move forward with other candidates for this role.</p><p>We appreciate your interest in ${env.companyName} and wish you the very best in your search.</p><p>Regards,<br/>${env.companyName} HR</p>`,
      })
    );
  }
  if (env.hrNotificationEmail) {
    sends.push(
      emailService.sendEmail({
        to: env.hrNotificationEmail,
        subject: `[Copy] ${subject} — ${applicantName}`,
        html: `<p>Applicant: ${applicantName} (${applicant.email || 'no email on file'}, ${applicant.phone || 'no phone on file'})</p><p>Rejection reason: ${rejectionReason || 'none given'}</p>`,
      })
    );
  }

  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === 'rejected') logger.error({ err: result.reason }, 'Reject email send failed');
  }
}

// Hiring creates a real Employee record pre-filled from the application, so
// the admin drops straight into the same onboarding/document-generation flow
// used for any other employee — no separate "recruit onboarding" feature.
// positionAppliedFor can hold multiple comma-joined positions (a Google Form
// checkbox question comes back as several values, see googleFormMapper.js) —
// hiredPosition is the single one the frontend asked the admin to pick when
// that's the case; required server-side too so the check can't be skipped.
async function hireApplicant(id, { selectionNotes, decisionDate, startDate, hiredPosition }) {
  const applicant = await applicantRepository.findById(id);
  if (!applicant) throw ApiError.notFound('Applicant not found');
  assertReadyForDecision(applicant);

  const appliedPositions = (applicant.positionAppliedFor || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (appliedPositions.length > 1 && !hiredPosition) {
    throw ApiError.badRequest('This applicant applied for multiple positions — select the one to hire them for');
  }

  const employee = await employeeService.createEmployee({
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    personalEmail: applicant.email,
    phone: applicant.phone,
    instagramId: applicant.instagramId,
    designation: hiredPosition || applicant.positionAppliedFor || 'TBD',
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

  sendHireEmail(updatedApplicant, employee).catch((err) => logger.error({ err }, 'sendHireEmail failed'));

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

  sendRejectEmail(updatedApplicant, rejectionReason).catch((err) => logger.error({ err }, 'sendRejectEmail failed'));

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
