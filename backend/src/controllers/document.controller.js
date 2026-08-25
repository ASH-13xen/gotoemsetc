const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const docGenerationService = require('../services/docGeneration.service');
const documentOverviewService = require('../services/documentOverview.service');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');

const generate = asyncHandler(async (req, res) => {
  const { templateIds, overrides } = req.body;
  const results = await docGenerationService.generateForEmployee(
    req.params.id,
    templateIds,
    overrides
  );
  res.status(201).json({ results });
});

const listForEmployee = asyncHandler(async (req, res) => {
  const documents = await generatedDocumentRepository.listByEmployee(req.params.id);
  res.json({ documents });
});

// Global, cross-employee — backs the Dashboard's "Documents generated this
// month" stat click-through in frontendems. Defaults to the start of the
// current month, same as dashboard.service.js#getStats, so the number and
// the list it opens into always agree unless the caller overrides `since`.
const listRecent = asyncHandler(async (req, res) => {
  let since = req.query.since ? new Date(req.query.since) : null;
  if (!since || Number.isNaN(since.getTime())) {
    since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
  }
  const documents = await generatedDocumentRepository.listCompletedSince(since);
  res.json({ documents });
});

const getById = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findById(req.params.id);
  if (!document) throw ApiError.notFound('Document not found');
  res.json({ document });
});

const downloadFile = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findByIdWithFile(req.params.id);
  const file = document?.pdf?.data ? document.pdf : document?.docx?.data ? document.docx : null;
  if (!document || !file) throw ApiError.notFound('Document not found');

  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.data);
});

const remove = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findById(req.params.id);
  if (!document) throw ApiError.notFound('Document not found');

  await generatedDocumentRepository.deleteById(document._id);

  res.status(204).send();
});

// The countersigned copy HR/admin uploads back after the employee physically
// signs a generated document — stored the same way as the generated file
// itself (bytes in Mongo), not Cloudinary (see GeneratedDocument.js).
const uploadSigned = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file was uploaded');
  const document = await generatedDocumentRepository.setSignedFile(req.params.docId, {
    data: req.file.buffer,
    contentType: req.file.mimetype,
    filename: req.file.originalname,
  });
  if (!document) throw ApiError.notFound('Document not found');
  res.status(201).json({ document });
});

const downloadSignedFile = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findByIdWithFile(req.params.id);
  if (!document?.signedFile?.data) throw ApiError.notFound('No signed copy on file');

  res.set('Content-Type', document.signedFile.contentType);
  res.set('Content-Disposition', `attachment; filename="${document.signedFile.filename}"`);
  res.send(document.signedFile.data);
});

// Self-service counterpart of downloadSignedFile above, nested under
// /employees/:id so requireSelfOrPermission can check ownership from the
// URL alone — this still double-checks the looked-up document actually
// belongs to :id, since :docId on its own doesn't prove that.
const downloadOwnSignedFile = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findByIdWithFile(req.params.docId);
  if (!document || document.employee.toString() !== req.params.id) {
    throw ApiError.notFound('Document not found');
  }
  if (!document.signedFile?.data) throw ApiError.notFound('No signed copy on file');

  res.set('Content-Type', document.signedFile.contentType);
  res.set('Content-Disposition', `attachment; filename="${document.signedFile.filename}"`);
  res.send(document.signedFile.data);
});

// HR Work bulk tool (frontendhr) — see documentOverview.service.js.
const overview = asyncHandler(async (req, res) => {
  const result = await documentOverviewService.getOverviewForTemplate(req.query.templateKey);
  res.json(result);
});

module.exports = {
  generate,
  listForEmployee,
  listRecent,
  getById,
  downloadFile,
  remove,
  uploadSigned,
  downloadSignedFile,
  downloadOwnSignedFile,
  overview,
};
