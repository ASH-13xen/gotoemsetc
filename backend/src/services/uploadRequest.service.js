const crypto = require('node:crypto');

const ApiError = require('../utils/ApiError');
const { UPLOAD_REQUEST_STATUS, DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS } = require('../config/constants');
const employeeRepository = require('../repositories/employee.repository');
const uploadRequestRepository = require('../repositories/uploadRequest.repository');
const uploadedDocumentRepository = require('../repositories/uploadedDocument.repository');
const cloudinaryUploadService = require('./cloudinaryUpload.service');
const activityService = require('./activity.service');

async function createRequest(employeeId, { requestedDocTypes, expiresInHours }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + (expiresInHours || DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS) * 60 * 60 * 1000
  );

  const uploadRequest = await uploadRequestRepository.create({
    employee: employee._id,
    token,
    requestedDocTypes,
    expiresAt,
  });

  await activityService.log(employee._id, 'UPLOAD_REQUEST_CREATED', { requestedDocTypes });

  return { uploadRequest };
}

async function listForEmployee(employeeId) {
  return uploadRequestRepository.listByEmployee(employeeId);
}

async function revoke(id) {
  const uploadRequest = await uploadRequestRepository.updateStatus(id, UPLOAD_REQUEST_STATUS.REVOKED);
  if (!uploadRequest) throw ApiError.notFound('Upload request not found');
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
    throw ApiError.forbidden('This link has expired.');
  }
  return uploadRequest;
}

async function getPublicStatus(rawToken) {
  const uploadRequest = await resolveToken(rawToken);
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

async function attachDocuments(rawToken, files) {
  const uploadRequest = await resolveToken(rawToken);

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
  const uploadedTypes = new Set(uploaded.map((d) => d.docType));
  const allFulfilled = uploadRequest.requestedDocTypes.every((t) => uploadedTypes.has(t));
  await uploadRequestRepository.updateStatus(
    uploadRequest._id,
    allFulfilled ? UPLOAD_REQUEST_STATUS.FULFILLED : UPLOAD_REQUEST_STATUS.PARTIALLY_FULFILLED,
    allFulfilled ? { fulfilledAt: new Date() } : {}
  );

  await activityService.log(
    uploadRequest.employee,
    'DOCUMENTS_UPLOADED_BY_EMPLOYEE',
    { docTypes: validFiles.map((f) => f.fieldname) },
    'employee-link'
  );

  return saved;
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
  getPublicStatus,
  attachDocuments,
  listUploadedForEmployee,
  deleteUploadedDocument,
};
