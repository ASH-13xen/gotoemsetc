const inventoryCategoryRepository = require('../repositories/inventoryCategory.repository');

async function listCategories() {
  return inventoryCategoryRepository.list();
}

// Same "pick existing or type a new one, which is then saved for later"
// pattern as the Task Management step library — a topic only needs to be
// typed once.
async function getOrCreateCategory(name) {
  const trimmed = name.trim();
  const existing = await inventoryCategoryRepository.findByName(trimmed);
  if (existing) return existing;

  try {
    return await inventoryCategoryRepository.create({ name: trimmed });
  } catch (err) {
    // Two admins racing to create the same new topic — the unique index
    // rejects the loser, who just gets the winner's doc instead of an error.
    if (err.code === 11000) {
      const winner = await inventoryCategoryRepository.findByName(trimmed);
      if (winner) return winner;
    }
    throw err;
  }
}

module.exports = { listCategories, getOrCreateCategory };
