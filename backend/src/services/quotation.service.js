const crypto = require('node:crypto');
const path = require('node:path');

const ApiError = require('../utils/ApiError');
const { QUOTATION_STATUS, CLIENT_STATUS, DEFAULT_QUOTATION_SHARE_EXPIRY_HOURS } = require('../config/constants');
const quotationRepository = require('../repositories/quotation.repository');
const clientRepository = require('../repositories/client.repository');
const quotationTemplateRepository = require('../repositories/quotationTemplate.repository');
const localFileStorage = require('./localFileStorage.service');
const pdfStampService = require('./pdfStamp.service');
const clientActivity = require('./clientActivity.service');
const taskCycleService = require('./taskCycle.service');

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function saveQuotationPdf(buffer, clientId, suffix) {
  const relativePath = path.join(String(clientId), `${suffix}-${Date.now()}.pdf`);
  return localFileStorage.saveBuffer(buffer, relativePath);
}

async function listForClient(clientId) {
  return quotationRepository.listByClient(clientId);
}

// Generates a fresh quotation for a client. This is also the "Change
// Quotation" action — every call here supersedes whatever quotation
// currently exists for the client, regardless of its status (draft, shared,
// or even already signed), and if the client had been onboarded off a prior
// signed quotation, their status reverts to "lead" immediately since the
// deal they were onboarded on no longer stands.
async function generateQuotation(clientId, { templateId, planOptionKey }) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  const template = await quotationTemplateRepository.findById(templateId);
  if (!template) throw ApiError.notFound('Quotation template not found');
  if (!template.isConfigured) {
    throw ApiError.badRequest('This template has not been calibrated yet — use the Template Mapper first.');
  }

  if (template.planType !== 'fixed') {
    const validOption = template.planOptions.some((o) => o.key === planOptionKey);
    if (!validOption) throw ApiError.badRequest('planOptionKey must match one of this template\'s plan options');
  }

  const pdfBuffer = await pdfStampService.generateQuotationPdf(template, {
    clientName: client.clientName,
    brandName: client.brandName,
    date: new Date(),
    planOptionKey: template.planType === 'fixed' ? undefined : planOptionKey,
  });

  const filePath = await saveQuotationPdf(pdfBuffer, clientId, 'draft');

  await quotationRepository.supersedeAllForClient(clientId);

  const latest = await quotationRepository.findLatestVersion(clientId);
  const version = (latest?.version || 0) + 1;

  const quotation = await quotationRepository.create({
    client: clientId,
    template: template._id,
    version,
    planOptionKey: template.planType === 'fixed' ? undefined : planOptionKey,
    status: QUOTATION_STATUS.DRAFT,
    generatedFile: { filePath },
  });

  // The previous deal is void the moment a new quotation is generated —
  // reflect that on the client immediately rather than waiting for the new
  // one to be signed.
  if (client.status === CLIENT_STATUS.ONBOARDED) {
    await clientRepository.updateById(clientId, { status: CLIENT_STATUS.LEAD, currentQuotation: null });
  }

  await clientActivity.log(clientId, 'QUOTATION_GENERATED', { template: template.title, version });

  return quotationRepository.findById(quotation._id);
}

// Admin draws their signature, it's stamped onto the draft, and a public
// share link is minted in the same action.
async function adminSign(quotationId, signatureDataUrl) {
  const quotation = await quotationRepository.findById(quotationId);
  if (!quotation) throw ApiError.notFound('Quotation not found');
  if (quotation.status !== QUOTATION_STATUS.DRAFT) {
    throw ApiError.badRequest('Only a draft quotation can be admin-signed. Start a new quotation to make changes.');
  }

  const template = quotation.template;
  const draftBuffer = await localFileStorage.readBuffer(quotation.generatedFile.filePath);
  const signedBuffer = await pdfStampService.stampSignature(draftBuffer, template.fields.adminSignature, signatureDataUrl);
  const filePath = await saveQuotationPdf(signedBuffer, quotation.client, 'admin-signed');

  const rawToken = crypto.randomBytes(32).toString('hex');
  const shareTokenExpiresAt = new Date(Date.now() + DEFAULT_QUOTATION_SHARE_EXPIRY_HOURS * 60 * 60 * 1000);

  await quotationRepository.updateById(quotationId, {
    adminSignedFile: { filePath },
    status: QUOTATION_STATUS.SHARED,
    shareTokenHash: hashToken(rawToken),
    shareTokenExpiresAt,
    sharedAt: new Date(),
  });

  const updated = await quotationRepository.findById(quotationId);
  await clientActivity.log(quotation.client, 'QUOTATION_SHARED', { version: quotation.version });
  return { quotation: updated, rawToken };
}

// Mints a fresh share link for a quotation that's already been admin-signed
// — lets the admin re-fetch a shareable link (and re-open the WhatsApp/Gmail
// share buttons) any time after the initial sign, not just in the one-shot
// moment right after signing. Only the token's hash is ever stored, so the
// raw link can't simply be "looked up" again — this issues a new one and
// invalidates whatever link was shared before.
async function regenerateShareLink(quotationId) {
  const quotation = await quotationRepository.findById(quotationId);
  if (!quotation) throw ApiError.notFound('Quotation not found');
  if (!quotation.adminSignedFile) {
    throw ApiError.badRequest('This quotation hasn\'t been signed yet — sign it first to generate a share link.');
  }
  if (quotation.status === QUOTATION_STATUS.SUPERSEDED) {
    throw ApiError.badRequest('This quotation has been superseded and can no longer be shared.');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const shareTokenExpiresAt = new Date(Date.now() + DEFAULT_QUOTATION_SHARE_EXPIRY_HOURS * 60 * 60 * 1000);

  await quotationRepository.updateById(quotationId, {
    shareTokenHash: hashToken(rawToken),
    shareTokenExpiresAt,
    sharedAt: new Date(),
  });

  const updated = await quotationRepository.findById(quotationId);
  return { quotation: updated, rawToken };
}

// Re-validated on every public request, not just at share time.
async function resolvePublicToken(rawToken) {
  const quotation = await quotationRepository.findByTokenHash(hashToken(rawToken));
  if (!quotation) throw ApiError.notFound('This quotation link is invalid.');
  if (quotation.status === QUOTATION_STATUS.SUPERSEDED) {
    throw ApiError.forbidden('This quotation has been replaced by a newer version. Please request a new link.');
  }
  if (quotation.shareTokenExpiresAt && quotation.shareTokenExpiresAt.getTime() < Date.now()) {
    throw ApiError.forbidden('This quotation link has expired. Please request a new one.');
  }
  return quotation;
}

async function getPublicQuotation(rawToken) {
  const quotation = await resolvePublicToken(rawToken);
  return {
    clientName: quotation.client.clientName,
    brandName: quotation.client.brandName,
    templateTitle: quotation.template.title,
    companyLabel: quotation.template.companyLabel,
    status: quotation.status,
  };
}

// Resolves which on-disk file the public link should currently serve —
// shared quotations show the admin-signed draft, signed ones show the final.
async function getPublicFilePath(rawToken) {
  const quotation = await resolvePublicToken(rawToken);
  return quotation.status === QUOTATION_STATUS.SIGNED
    ? quotation.finalSignedFile.filePath
    : quotation.adminSignedFile.filePath;
}

async function clientSign(rawToken, signatureDataUrl) {
  const quotation = await resolvePublicToken(rawToken);

  // Idempotent: a double-submit (double click, refresh after signing)
  // just returns the already-final file instead of re-stamping.
  if (quotation.status === QUOTATION_STATUS.SIGNED) {
    return { quotationId: quotation._id.toString() };
  }

  const template = quotation.template;
  const adminSignedBuffer = await localFileStorage.readBuffer(quotation.adminSignedFile.filePath);
  const finalBuffer = await pdfStampService.stampSignature(
    adminSignedBuffer,
    template.fields.clientSignature,
    signatureDataUrl
  );
  const filePath = await saveQuotationPdf(finalBuffer, quotation.client._id, 'final-signed');

  await quotationRepository.updateById(quotation._id, {
    finalSignedFile: { filePath },
    status: QUOTATION_STATUS.SIGNED,
    signedAt: new Date(),
  });

  // onboardedAt only gets set the first time — a later re-sign (new
  // quotation version) shouldn't reset the recurring task cycle anchor.
  await clientRepository.updateById(quotation.client._id, {
    status: CLIENT_STATUS.ONBOARDED,
    currentQuotation: quotation._id,
    ...(quotation.client.onboardedAt ? {} : { onboardedAt: new Date() }),
  });

  await clientActivity.log(quotation.client._id, 'QUOTATION_SIGNED', { version: quotation.version }, 'client-link');

  // Best-effort: task generation depends on the template's Scope of Work
  // being configured, which isn't guaranteed — a missing/misconfigured
  // template must never block the signing flow that already succeeded. The
  // daily cron and the manual "Sync tasks now" button both cover this as a
  // fallback if it fails or was skipped here.
  try {
    await taskCycleService.syncClientCycle(quotation.client._id);
  } catch (err) {
    console.error('Task generation after quotation sign failed:', err);
  }

  return { quotationId: quotation._id.toString() };
}

// Admin-facing: resolves the absolute disk path for a given quotation +
// variant, used by the download route. Not token-gated — same trust level
// as the rest of the admin API.
async function getFilePathForVariant(quotationId, variant) {
  const quotation = await quotationRepository.findById(quotationId);
  if (!quotation) throw ApiError.notFound('Quotation not found');
  const fileRef = { draft: quotation.generatedFile, 'admin-signed': quotation.adminSignedFile, final: quotation.finalSignedFile }[
    variant
  ];
  if (!fileRef) throw ApiError.notFound('That version of this quotation is not available.');
  return fileRef.filePath;
}

module.exports = {
  listForClient,
  generateQuotation,
  adminSign,
  regenerateShareLink,
  getPublicQuotation,
  getPublicFilePath,
  clientSign,
  getFilePathForVariant,
};
