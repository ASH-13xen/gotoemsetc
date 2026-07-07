const asyncHandler = require('../utils/asyncHandler');
const templateService = require('../services/template.service');

const list = asyncHandler(async (req, res) => {
  const templates = await templateService.listTemplates(req.query);
  res.json({ templates });
});

const getById = asyncHandler(async (req, res) => {
  const template = await templateService.getTemplate(req.params.id);
  res.json({ template });
});

module.exports = { list, getById };
