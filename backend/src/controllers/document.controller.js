const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const docGenerationService = require('../services/docGeneration.service');
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

module.exports = { generate, listForEmployee, getById, downloadFile, remove };
