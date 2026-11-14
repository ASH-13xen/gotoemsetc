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
  // The company's signature (the CEO's or HR's, as the template names) is
  // placed now, when it's on file; the exact HTML is kept so the employee can
  // sign this same document online later (esign.service.js).
  const { html: filledHtml } = await require('./esign.service').withCompanySignatures(fillTemplate(templateHtml, mergeData));
  const pdfBuffer = await renderPdfFromHtml(filledHtml, env.templatesHtmlDir);

  return {
    pdf: { data: pdfBuffer, contentType: PDF_CONTENT_TYPE, filename: `${template.key}.pdf` },
    html: filledHtml,
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
// The full & final settlement can only be made once both offboarding boxes
// are ticked — the person is out of the groups and Go-To Reels, and their
// company mail is deactivated.
async function assertCanGenerateFnf(employee) {
  const missing = [];
  if (!employee.removedFromGroupsAndReels) missing.push('"Removed from groups + Go-To Reels"');
  if (!employee.mailDeactivated) missing.push('"Mail deactivated"');
  if (missing.length) {
    throw ApiError.badRequest(
      `Tick ${missing.join(' and ')} in their offboarding details before generating the full & final settlement`
    );
  }
  // Every company device has to be back first — returned, or marked lost
  // (HR Work → Devices); a lost one's recovery still comes off the settlement.
  const DeviceAssignment = require('../models/DeviceAssignment');
  const held = await DeviceAssignment.find({ employee: employee._id, status: 'active' }).populate('device', 'code brand model').lean();
  if (held.length) {
    const names = held.map((a) => (a.device ? [a.device.code, a.device.brand, a.device.model].filter(Boolean).join(' ') : 'a device')).join(', ');
    throw ApiError.badRequest(
      `${employee.firstName} still has ${held.length === 1 ? 'a company device' : `${held.length} company devices`} (${names}) — take ${held.length === 1 ? 'it' : 'them'} back, or mark ${held.length === 1 ? 'it' : 'them'} lost, in HR Work → Devices before generating the full & final settlement`
    );
  }
}

async function generateForEmployee(employeeId, templateIds, overrides = {}) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const requested = await Promise.all(templateIds.map((id) => documentTemplateRepository.findById(id)));
  if (requested.some((t) => t?.key === 'fnf-settlement')) await assertCanGenerateFnf(employee);

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
      // Finance section — an FnF settlement document is a payment due the
      // moment it's generated. Lazy require avoids a hard dependency between
      // the generic document pipeline and Finance for every other template.
      if (template.key === 'fnf-settlement') {
        await require('./fnfSettlement.service').createFromGeneratedDocument(
          document,
          employee._id,
          overrides.severanceAmount,
          overrides.separationDate
        );
      }
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
