const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const docGenerationService = require('../services/docGeneration.service');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');
const cloudinaryUploadService = require('../services/cloudinaryUpload.service');
const localFileStorage = require('../services/localFileStorage.service');

const GENERATED_PDF_NAMESPACE = 'generated-documents';

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

const getById = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findById(req.params.id);
  if (!document) throw ApiError.notFound('Document not found');
  res.json({ document });
});

const downloadPdf = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findById(req.params.id);
  if (!document || !document.pdf?.filePath) throw ApiError.notFound('Document not found');
  res.sendFile(localFileStorage.absolutePathFor(document.pdf.filePath, GENERATED_PDF_NAMESPACE));
});

const remove = asyncHandler(async (req, res) => {
  const document = await generatedDocumentRepository.findById(req.params.id);
  if (!document) throw ApiError.notFound('Document not found');

  if (document.docx?.publicId) await cloudinaryUploadService.destroy(document.docx.publicId);
  if (document.pdf?.filePath) await localFileStorage.deleteFile(document.pdf.filePath, GENERATED_PDF_NAMESPACE);
  await generatedDocumentRepository.deleteById(document._id);

  res.status(204).send();
});

module.exports = { generate, listForEmployee, getById, downloadPdf, remove };
