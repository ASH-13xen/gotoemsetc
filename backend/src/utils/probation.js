// Probation is over when HR ticks "Probation completed" on the employee —
// nothing else decides it (no joining-date arithmetic, no tick date).
function isPastProbation(employee) {
  return Boolean(employee?.probationCompleted);
}

module.exports = { isPastProbation };
