const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const documentTemplateRepository = require('../repositories/documentTemplate.repository');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');

// HR Work's "Show all generated documents" tool (frontendhr) — every active
// employee bucketed into generated+signed / generated / not generated for
// one template.
async function getOverviewForTemplate(templateKey) {
  const template = await documentTemplateRepository.findByKey(templateKey);
  if (!template) throw ApiError.notFound('Template not found');

  const [employees, documents] = await Promise.all([
    employeeRepository.listActive(),
    generatedDocumentRepository.listByTemplate(template._id),
  ]);

  // Most-recent-first from the repository — the first match kept per
  // employee is their latest generated copy of this template.
  const docByEmployee = new Map();
  for (const doc of documents) {
    const key = doc.employee.toString();
    if (!docByEmployee.has(key)) docByEmployee.set(key, doc);
  }

  const rows = employees.map((employee) => {
    const doc = docByEmployee.get(employee._id.toString());
    let bucket;
    if (!doc) bucket = 'not_generated';
    else if (doc.signedFile?.filename) bucket = 'generated_and_signed';
    else bucket = 'generated';

    return {
      employeeId: employee._id,
      employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
      employeeCode: employee.employeeCode,
      bucket,
      documentId: doc ? doc._id : null,
    };
  });

  return { template: { key: template.key, title: template.title }, rows };
}

module.exports = { getOverviewForTemplate };
