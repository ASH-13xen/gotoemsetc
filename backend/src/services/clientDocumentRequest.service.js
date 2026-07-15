const crypto = require('node:crypto');
const path = require('node:path');

const ApiError = require('../utils/ApiError');
const { UPLOAD_REQUEST_STATUS, DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS } = require('../config/constants');
const clientRepository = require('../repositories/client.repository');
const clientDocumentRequestRepository = require('../repositories/clientDocumentRequest.repository');
const clientUploadedDocumentRepository = require('../repositories/clientUploadedDocument.repository');
const localFileStorage = require('./localFileStorage.service');
const clientActivity = require('./clientActivity.service');

const NAMESPACE = 'client-documents';

function generateAccessCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function createRequest(clientId, { requestedDocTypes, expiresInHours }) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  const token = crypto.randomBytes(32).toString('hex');
  const accessCode = generateAccessCode();
  const expiresAt = new Date(
    Date.now() + (expiresInHours || DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS) * 60 * 60 * 1000
  );

  const request = await clientDocumentRequestRepository.create({
    client: clientId,
    token,
    accessCode,
    requestedDocTypes,
    expiresAt,
  });

  await clientActivity.log(clientId, 'DOCUMENT_REQUEST_CREATED', { requestedDocTypes });

  return request;
}

async function listForClient(clientId) {
  await clientDocumentRequestRepository.clearExpiredAccessCodes(clientId);
  return clientDocumentRequestRepository.listByClient(clientId);
}

async function revoke(id) {
  const request = await clientDocumentRequestRepository.updateStatus(id, UPLOAD_REQUEST_STATUS.REVOKED);
  if (!request) throw ApiError.notFound('Document request not found');
  await clientDocumentRequestRepository.clearAccessCode(id);
  await clientActivity.log(request.client, 'DOCUMENT_REQUEST_REVOKED', {});
  return request;
}

async function resolveToken(rawToken) {
  const request = await clientDocumentRequestRepository.findByToken(rawToken);
  if (!request) throw ApiError.notFound('This link is invalid.');
  if (request.status === UPLOAD_REQUEST_STATUS.REVOKED) {
    throw ApiError.forbidden('This link has been revoked.');
  }
  if (request.expiresAt.getTime() < Date.now()) {
    if (request.accessCode) await clientDocumentRequestRepository.clearAccessCode(request._id);
    throw ApiError.forbidden('This link has expired.');
  }
  return request;
}

async function verifyAccessCode(rawToken, code) {
  const request = await resolveToken(rawToken);
  if (!request.accessCode || request.accessCode !== code) {
    throw ApiError.forbidden('Incorrect access code.');
  }
  return request;
}

async function getPublicStatus(rawToken, code) {
  const request = await verifyAccessCode(rawToken, code);
  const client = await clientRepository.findById(request.client);
  const uploaded = await clientUploadedDocumentRepository.listByRequest(request._id);

  return {
    clientName: client.clientName,
    brandName: client.brandName,
    requestedDocTypes: request.requestedDocTypes,
    uploadedSlots: uploaded.map((d) => d.slotIndex),
    status: request.status,
    expiresAt: request.expiresAt,
  };
}

// Files travel with field names "doc_<slotIndex>" — a positional slot
// rather than the freeform label text itself, since arbitrary text isn't
// safe to use as a multipart field name (spaces, duplicates, special
// characters).
async function attachDocuments(rawToken, code, files) {
  const request = await verifyAccessCode(rawToken, code);

  const validFiles = files
    .map((file) => {
      const match = /^doc_(\d+)$/.exec(file.fieldname);
      if (!match) return null;
      const slotIndex = Number(match[1]);
      if (slotIndex < 0 || slotIndex >= request.requestedDocTypes.length) return null;
      return { file, slotIndex, docLabel: request.requestedDocTypes[slotIndex] };
    })
    .filter(Boolean);

  if (validFiles.length === 0) {
    throw ApiError.badRequest('No recognized documents were included in the upload.');
  }

  const saved = [];
  for (const { file, slotIndex, docLabel } of validFiles) {
    const relativePath = path.join(
      String(request.client),
      `${slotIndex}-${Date.now()}-${Math.round(Math.random() * 1e6)}-${file.originalname}`
    );
    const filePath = await localFileStorage.saveBuffer(file.buffer, relativePath, NAMESPACE);
    const doc = await clientUploadedDocumentRepository.create({
      client: request.client,
      clientDocumentRequest: request._id,
      slotIndex,
      docLabel,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      filePath,
    });
    saved.push(doc);
  }

  const uploaded = await clientUploadedDocumentRepository.listByRequest(request._id);
  const uploadedSlots = [...new Set(uploaded.map((d) => d.slotIndex))];
  const allFulfilled = request.requestedDocTypes.every((_, i) => uploadedSlots.includes(i));
  const status = allFulfilled ? UPLOAD_REQUEST_STATUS.FULFILLED : UPLOAD_REQUEST_STATUS.PARTIALLY_FULFILLED;
  await clientDocumentRequestRepository.updateStatus(
    request._id,
    status,
    allFulfilled ? { fulfilledAt: new Date() } : {}
  );
  // Once fully fulfilled the access code is cleared immediately (nothing
  // left to submit, so it shouldn't keep working) — the caller must use
  // this response to update its own view rather than re-verifying the code
  // against the server afterward, since that verification would now fail.
  if (allFulfilled) await clientDocumentRequestRepository.clearAccessCode(request._id);

  await clientActivity.log(
    request.client,
    'DOCUMENTS_UPLOADED_BY_CLIENT',
    { labels: validFiles.map((v) => v.docLabel) },
    'client-link'
  );

  return { documents: saved, status, uploadedSlots };
}

async function listUploadedForClient(clientId) {
  return clientUploadedDocumentRepository.listByClient(clientId);
}

async function getUploadedFilePath(id) {
  const doc = await clientUploadedDocumentRepository.findById(id);
  if (!doc) throw ApiError.notFound('Document not found');
  return { filePath: doc.filePath, namespace: NAMESPACE, filename: doc.originalFilename };
}

async function deleteUploadedDocument(id) {
  const doc = await clientUploadedDocumentRepository.findById(id);
  if (!doc) throw ApiError.notFound('Document not found');
  await localFileStorage.deleteFile(doc.filePath, NAMESPACE);
  await clientUploadedDocumentRepository.deleteById(id);
}

module.exports = {
  createRequest,
  listForClient,
  revoke,
  verifyAccessCode,
  getPublicStatus,
  attachDocuments,
  listUploadedForClient,
  getUploadedFilePath,
  deleteUploadedDocument,
};
