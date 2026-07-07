const fs = require('node:fs/promises');
const path = require('node:path');

const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const documentTemplateRepository = require('../repositories/documentTemplate.repository');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');
const { buildMergeData } = require('./mergeData.service');
const { renderDocx } = require('./docxRender.service');
const cloudinaryUploadService = require('./cloudinaryUpload.service');
const activityService = require('./activity.service');

async function generateOne(employee, template, overrides) {
  const mergeData = buildMergeData(template, employee, overrides);

  const templateBuffer = await fs.readFile(path.join(env.templatesDir, template.docxFilePath));
  const docxBuffer = renderDocx(templateBuffer, mergeData);

  const upload = await cloudinaryUploadService.uploadBuffer(docxBuffer, {
    folder: `ems/employees/${employee._id}/generated`,
    // Cloudinary's `raw` resource type does not infer a file extension the
    // way `image`/`auto` do — without it, downloads show up as a generic
    // untyped "File" instead of being recognized as a .docx.
    publicId: `${template.key}-${Date.now()}.docx`,
    resourceType: 'raw',
  });

  return generatedDocumentRepository.create({
    employee: employee._id,
    template: template._id,
    templateVersion: template.version,
    mergeDataSnapshot: mergeData,
    docx: { url: upload.secure_url, publicId: upload.public_id, bytes: upload.bytes },
    status: 'completed',
  });
}

// Generates one document per requested template. Each template succeeds or
// fails independently — one bad template (missing field, broken tag) doesn't
// block the others from being generated.
async function generateForEmployee(employeeId, templateIds, overrides = {}) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const results = [];

  for (const templateId of templateIds) {
    const template = await documentTemplateRepository.findById(templateId);
    if (!template) {
      results.push({ templateId, status: 'failed', error: 'Template not found' });
      continue;
    }

    try {
      const document = await generateOne(employee, template, overrides);
      await activityService.log(employee._id, 'DOCUMENT_GENERATED', { templateKey: template.key });
      results.push({ templateId, templateKey: template.key, status: 'completed', document });
    } catch (err) {
      const errorMessage = err.details ? `${err.message}: ${JSON.stringify(err.details)}` : err.message;
      const document = await generatedDocumentRepository.create({
        employee: employee._id,
        template: template._id,
        templateVersion: template.version,
        status: 'failed',
        errorMessage,
      });
      await activityService.log(employee._id, 'DOCUMENT_GENERATION_FAILED', {
        templateKey: template.key,
        error: errorMessage,
      });
      results.push({ templateId, templateKey: template.key, status: 'failed', error: errorMessage, document });
    }
  }

  return results;
}

module.exports = { generateForEmployee };
