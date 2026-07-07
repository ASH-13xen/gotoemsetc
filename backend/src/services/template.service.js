const documentTemplateRepository = require('../repositories/documentTemplate.repository');
const ApiError = require('../utils/ApiError');

async function listTemplates({ active }) {
  return documentTemplateRepository.list({ active });
}

async function getTemplate(id) {
  const template = await documentTemplateRepository.findById(id);
  if (!template) throw ApiError.notFound('Template not found');
  return template;
}

module.exports = { listTemplates, getTemplate };
