const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const quotationService = require('../services/quotation.service');
const localFileStorage = require('../services/localFileStorage.service');

const listForClient = asyncHandler(async (req, res) => {
  const quotations = await quotationService.listForClient(req.params.id);
  res.json({ quotations });
});

const generate = asyncHandler(async (req, res) => {
  const quotation = await quotationService.generateQuotation(req.params.id, req.body);
  res.status(201).json({ quotation });
});

const adminSign = asyncHandler(async (req, res) => {
  const { quotation, rawToken } = await quotationService.adminSign(req.params.id, req.body.signatureDataUrl);
  const shareUrl = `${env.salesFrontendUrl}/quotation/${rawToken}`;
  res.json({ quotation, shareToken: rawToken, shareUrl });
});

const shareLink = asyncHandler(async (req, res) => {
  const { quotation, rawToken } = await quotationService.regenerateShareLink(req.params.id);
  const shareUrl = `${env.salesFrontendUrl}/quotation/${rawToken}`;
  res.json({ quotation, shareToken: rawToken, shareUrl });
});

const downloadFile = asyncHandler(async (req, res) => {
  const filePath = await quotationService.getFilePathForVariant(req.params.id, req.params.variant);
  res.sendFile(localFileStorage.absolutePathFor(filePath));
});

const getPublic = asyncHandler(async (req, res) => {
  const quotation = await quotationService.getPublicQuotation(req.params.token);
  res.json({ quotation });
});

const getPublicFile = asyncHandler(async (req, res) => {
  const filePath = await quotationService.getPublicFilePath(req.params.token);
  res.sendFile(localFileStorage.absolutePathFor(filePath));
});

const signPublic = asyncHandler(async (req, res) => {
  const result = await quotationService.clientSign(req.params.token, req.body.signatureDataUrl);
  res.json(result);
});

module.exports = { listForClient, generate, adminSign, shareLink, downloadFile, getPublic, getPublicFile, signPublic };
