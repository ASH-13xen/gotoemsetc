const crypto = require('node:crypto');

const ApiError = require('../utils/ApiError');
const { UPLOAD_REQUEST_STATUS, DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS } = require('../config/constants');
const DOC_TYPES = require('../config/docTypes');
const employeeRepository = require('../repositories/employee.repository');
const uploadRequestRepository = require('../repositories/uploadRequest.repository');
const uploadedDocumentRepository = require('../repositories/uploadedDocument.repository');
const cloudinaryUploadService = require('./cloudinaryUpload.service');
const activityService = require('./activity.service');
const emailService = require('./email.service');
const env = require('../config/env');
const logger = require('../utils/logger');

// 6-digit numeric — short enough to read out over a phone call or retype
// from a WhatsApp message, delivered separately from (and required in
// addition to) the link itself.
function generateAccessCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Fire-and-forget, same pattern as sendInterviewEmails — the request is
// still created and returned to the admin either way.
async function sendUploadRequestEmail(employee, requestedDocTypes, link, accessCode) {
  if (!employee.personalEmail) return;

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  const docLabels = requestedDocTypes
    .map((key) => DOC_TYPES.find((d) => d.key === key)?.label ?? key)
    .join(', ');
  const subject = `Document Request — ${env.companyName}`;
  const html = `<p>Hi ${employeeName},</p><p>Please upload the following documents using the secure link below:</p><p>${docLabels}</p><p><a href="${link}">${link}</a></p><p>You'll be asked for this access code before you can upload: <strong>${accessCode}</strong></p><p>Thanks,<br/>${env.companyName} HR</p>`;

  await emailService.sendEmail({ to: employee.personalEmail, subject, html });
}

async function createRequest(employeeId, { requestedDocTypes, expiresInHours }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const token = crypto.randomBytes(32).toString('hex');
  const accessCode = generateAccessCode();
  const expiresAt = new Date(
    Date.now() + (expiresInHours || DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS) * 60 * 60 * 1000
  );

  const uploadRequest = await uploadRequestRepository.create({
    employee: employee._id,
    token,
    accessCode,
    requestedDocTypes,
    expiresAt,
  });

  await activityService.log(employee._id, 'UPLOAD_REQUEST_CREATED', { requestedDocTypes });

  const link = `${env.frontendUrl}/upload/${token}`;
  sendUploadRequestEmail(employee, requestedDocTypes, link, accessCode).catch((err) =>
    logger.error({ err }, 'sendUploadRequestEmail failed')
  );

  return { uploadRequest };
}

async function listForEmployee(employeeId) {
  await uploadRequestRepository.clearExpiredAccessCodes(employeeId);
  return uploadRequestRepository.listByEmployee(employeeId);
}

async function revoke(id) {
  const uploadRequest = await uploadRequestRepository.updateStatus(id, UPLOAD_REQUEST_STATUS.REVOKED);
  if (!uploadRequest) throw ApiError.notFound('Upload request not found');
  await uploadRequestRepository.clearAccessCode(id);
  await activityService.log(uploadRequest.employee, 'UPLOAD_REQUEST_REVOKED', {});
  return uploadRequest;
}

// Re-validated on every public request, not just at link creation, so a
// revoke or expiry takes effect immediately.
async function resolveToken(rawToken) {
  const uploadRequest = await uploadRequestRepository.findByToken(rawToken);
  if (!uploadRequest) throw ApiError.notFound('This link is invalid.');
  if (uploadRequest.status === UPLOAD_REQUEST_STATUS.REVOKED) {
    throw ApiError.forbidden('This link has been revoked.');
  }
  if (uploadRequest.expiresAt.getTime() < Date.now()) {
    if (uploadRequest.accessCode) await uploadRequestRepository.clearAccessCode(uploadRequest._id);
    throw ApiError.forbidden('This link has expired.');
  }
  return uploadRequest;
}

// The access code is the actual login step — resolveToken only proves the
// link itself is still live. Both the status view and the upload itself
// require this, so simply knowing/forwarding the link isn't enough on its
// own to see or submit anything.
async function verifyAccessCode(rawToken, code) {
  const uploadRequest = await resolveToken(rawToken);
  if (!uploadRequest.accessCode || uploadRequest.accessCode !== code) {
    throw ApiError.forbidden('Incorrect access code.');
  }
  return uploadRequest;
}

async function getPublicStatus(rawToken, code) {
  const uploadRequest = await verifyAccessCode(rawToken, code);
  const employee = await employeeRepository.findById(uploadRequest.employee);
  const uploaded = await uploadedDocumentRepository.listByUploadRequest(uploadRequest._id);

  return {
    employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
    requestedDocTypes: uploadRequest.requestedDocTypes,
    uploadedDocTypes: uploaded.map((d) => d.docType),
    status: uploadRequest.status,
    expiresAt: uploadRequest.expiresAt,
  };
}

async function attachDocuments(rawToken, code, files) {
  const uploadRequest = await verifyAccessCode(rawToken, code);

  // Only accept files whose field name matches a doc type this request
  // actually asked for — keeps arbitrary strings from becoming docType values.
  const allowedTypes = new Set(uploadRequest.requestedDocTypes);
  const validFiles = files.filter((file) => allowedTypes.has(file.fieldname));
  if (validFiles.length === 0) {
    throw ApiError.badRequest('No recognized documents were included in the upload.');
  }

  const saved = [];
  for (const file of validFiles) {
    const upload = await cloudinaryUploadService.uploadBuffer(file.buffer, {
      folder: `ems/employees/${uploadRequest.employee}/uploaded`,
      publicId: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      resourceType: 'auto',
    });
    const doc = await uploadedDocumentRepository.create({
      employee: uploadRequest.employee,
      uploadRequest: uploadRequest._id,
      docType: file.fieldname,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      url: upload.secure_url,
      publicId: upload.public_id,
      resourceType: upload.resource_type,
    });
    saved.push(doc);
  }

  const uploaded = await uploadedDocumentRepository.listByUploadRequest(uploadRequest._id);
  const uploadedDocTypes = [...new Set(uploaded.map((d) => d.docType))];
  const allFulfilled = uploadRequest.requestedDocTypes.every((t) => uploadedDocTypes.includes(t));
  const status = allFulfilled ? UPLOAD_REQUEST_STATUS.FULFILLED : UPLOAD_REQUEST_STATUS.PARTIALLY_FULFILLED;
  await uploadRequestRepository.updateStatus(
    uploadRequest._id,
    status,
    allFulfilled ? { fulfilledAt: new Date() } : {}
  );
  // Once fully fulfilled the access code is cleared immediately — the
  // caller must use this response to update its own view rather than
  // re-verifying the code against the server afterward, since that
  // verification would now fail.
  if (allFulfilled) await uploadRequestRepository.clearAccessCode(uploadRequest._id);

  await activityService.log(
    uploadRequest.employee,
    'DOCUMENTS_UPLOADED_BY_EMPLOYEE',
    { docTypes: validFiles.map((f) => f.fieldname) },
    'employee-link'
  );

  return { documents: saved, status, uploadedDocTypes };
}

async function listUploadedForEmployee(employeeId) {
  return uploadedDocumentRepository.listByEmployee(employeeId);
}

async function deleteUploadedDocument(id) {
  const doc = await uploadedDocumentRepository.findById(id);
  if (!doc) throw ApiError.notFound('Uploaded document not found');
  if (doc.publicId) await cloudinaryUploadService.destroy(doc.publicId, { resourceType: doc.resourceType });
  await uploadedDocumentRepository.deleteById(id);
}

module.exports = {
  createRequest,
  listForEmployee,
  revoke,
  verifyAccessCode,
  getPublicStatus,
  attachDocuments,
  listUploadedForEmployee,
  deleteUploadedDocument,
};
