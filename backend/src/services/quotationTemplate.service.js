const ApiError = require('../utils/ApiError');
const quotationTemplateRepository = require('../repositories/quotationTemplate.repository');

function listTemplates() {
  return quotationTemplateRepository.list();
}

async function getTemplate(id) {
  const template = await quotationTemplateRepository.findById(id);
  if (!template) throw ApiError.notFound('Quotation template not found');
  return template;
}

// A template is only safe to generate quotations from once every field this
// specific layout needs has a calibrated position — which fields are needed
// varies per template (duration vs quantity vs fixed, combined name/brand, etc).
function isFullyConfigured(template, fields) {
  if (!fields.clientName) return false;
  if (template.hasBrandName && !template.combinedNameBrand && !fields.brandName) return false;
  if (template.hasDateField && !fields.date) return false;
  if (template.planType !== 'fixed') {
    if (
      !Array.isArray(fields.planCheckboxes) ||
      fields.planCheckboxes.length !== template.planOptions.length ||
      fields.planCheckboxes.some((position) => !position)
    ) {
      return false;
    }
  }
  if (template.planType === 'fixed' && template.fixedAmount && !fields.totalPayableAmount) return false;
  if (!fields.adminSignature) return false;
  if (!fields.clientSignature) return false;
  return true;
}

async function saveFieldPositions(id, fields) {
  const template = await getTemplate(id);
  const configured = isFullyConfigured(template, fields);
  const updated = await quotationTemplateRepository.updateFields(id, fields, configured);
  return updated;
}

async function saveScopeOfWork(id, scopeOfWork) {
  await getTemplate(id);
  return quotationTemplateRepository.updateScopeOfWork(id, scopeOfWork);
}

module.exports = { listTemplates, getTemplate, saveFieldPositions, saveScopeOfWork };
