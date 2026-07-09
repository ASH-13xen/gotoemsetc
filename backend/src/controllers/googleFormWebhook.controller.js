const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const applicantRepository = require('../repositories/applicant.repository');
const applicantService = require('../services/applicant.service');
const { mapGoogleFormPayload } = require('../utils/googleFormMapper');

const submit = asyncHandler(async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (!env.googleForm.webhookSecret || secret !== env.googleForm.webhookSecret) {
    throw ApiError.unauthorized('Invalid webhook secret');
  }

  const { googleFormResponseId } = req.body;
  if (!googleFormResponseId) {
    throw ApiError.badRequest('Missing googleFormResponseId');
  }

  const existing = await applicantRepository.findByGoogleFormResponseId(googleFormResponseId);
  if (existing) {
    // Apps Script retried a submission we already recorded — no-op.
    return res.status(200).json({ applicant: existing, deduped: true });
  }

  const { applicantData, resumeFiles } = mapGoogleFormPayload(req.body);
  const applicant = await applicantService.createApplicant(applicantData, resumeFiles);
  res.status(201).json({ applicant });
});

module.exports = { submit };
