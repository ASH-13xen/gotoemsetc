const asyncHandler = require('../utils/asyncHandler');
const stepLibraryService = require('../services/stepLibrary.service');

const list = asyncHandler(async (req, res) => {
  const steps = await stepLibraryService.listSteps();
  res.json({ steps });
});

const create = asyncHandler(async (req, res) => {
  const step = await stepLibraryService.createStep(req.body.label);
  res.status(201).json({ step });
});

const update = asyncHandler(async (req, res) => {
  const step = await stepLibraryService.updateStep(req.params.id, req.body.label);
  res.json({ step });
});

const remove = asyncHandler(async (req, res) => {
  await stepLibraryService.deleteStep(req.params.id);
  res.status(204).send();
});

module.exports = { list, create, update, remove };
