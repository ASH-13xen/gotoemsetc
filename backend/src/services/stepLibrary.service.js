const ApiError = require('../utils/ApiError');
const stepLibraryRepository = require('../repositories/stepLibrary.repository');
const StepLibrary = require('../models/StepLibrary');
const { DEFAULT_STEP_LIBRARY } = require('../config/constants');

async function listSteps() {
  const existing = await stepLibraryRepository.list();
  if (existing.length > 0) return existing;

  // First-run seed — lets a fresh install start picking steps immediately
  // instead of an empty picker with no explanation.
  await StepLibrary.insertMany(DEFAULT_STEP_LIBRARY.map((label) => ({ label })));
  return stepLibraryRepository.list();
}

async function createStep(label) {
  return stepLibraryRepository.create(label);
}

async function updateStep(id, label) {
  const step = await stepLibraryRepository.updateById(id, label);
  if (!step) throw ApiError.notFound('Step not found');
  return step;
}

async function deleteStep(id) {
  const step = await stepLibraryRepository.softDeleteById(id);
  if (!step) throw ApiError.notFound('Step not found');
}

module.exports = { listSteps, createStep, updateStep, deleteStep };
