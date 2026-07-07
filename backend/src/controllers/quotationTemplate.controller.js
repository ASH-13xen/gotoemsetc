const asyncHandler = require('../utils/asyncHandler');
const quotationTemplateService = require('../services/quotationTemplate.service');
const { templatePdfPath } = require('../services/pdfStamp.service');

const list = asyncHandler(async (req, res) => {
  const templates = await quotationTemplateService.listTemplates();
  res.json({ templates });
});

const getById = asyncHandler(async (req, res) => {
  const template = await quotationTemplateService.getTemplate(req.params.id);
  res.json({ template });
});

const getPdf = asyncHandler(async (req, res) => {
  const template = await quotationTemplateService.getTemplate(req.params.id);
  res.sendFile(templatePdfPath(template.pdfFilename));
});

const updateFields = asyncHandler(async (req, res) => {
  const template = await quotationTemplateService.saveFieldPositions(req.params.id, req.body);
  res.json({ template });
});

module.exports = { list, getById, getPdf, updateFields };
