const fs = require('node:fs/promises');
const path = require('node:path');

const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const documentTemplateRepository = require('../repositories/documentTemplate.repository');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');
const { buildMergeData } = require('./mergeData.service');
const { renderDocx } = require('./docxRender.service');
const { fillTemplate, renderPdfFromHtml } = require('./htmlRender.service');
const activityService = require('./activity.service');

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_CONTENT_TYPE = 'application/pdf';

// Generated files are stored as Buffers directly on the GeneratedDocument
// record (see models/GeneratedDocument.js) rather than Cloudinary or local
// disk — Cloudinary blocks unauthenticated delivery of raw/PDF files by
// account-level default, and Render's free-tier disk doesn't survive a
// redeploy. Mongo already persists everything else in this app.
async function generateDocx(employee, template, mergeData) {
  const templateBuffer = await fs.readFile(path.join(env.templatesDir, template.docxFilePath));
  const docxBuffer = renderDocx(templateBuffer, mergeData);

  return {
    docx: { data: docxBuffer, contentType: DOCX_CONTENT_TYPE, filename: `${template.key}.docx` },
  };
}

async function generateHtmlPdf(employee, template, mergeData) {
  const templateHtml = await fs.readFile(
    path.join(env.templatesHtmlDir, template.htmlFilePath),
    'utf8'
  );
  const filledHtml = fillTemplate(templateHtml, mergeData);
  const pdfBuffer = await renderPdfFromHtml(filledHtml, env.templatesHtmlDir);

  return {
    pdf: { data: pdfBuffer, contentType: PDF_CONTENT_TYPE, filename: `${template.key}.pdf` },
  };
}

async function generateOne(employee, template, overrides) {
  const mergeData = buildMergeData(template, employee, overrides);

  const fileFields =
    template.templateType === 'html'
      ? await generateHtmlPdf(employee, template, mergeData)
      : await generateDocx(employee, template, mergeData);

  return generatedDocumentRepository.create({
    employee: employee._id,
    template: template._id,
    templateVersion: template.version,
    mergeDataSnapshot: mergeData,
    ...fileFields,
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
