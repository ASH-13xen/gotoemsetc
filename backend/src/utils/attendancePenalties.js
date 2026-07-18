// Every 2 Lates converts to 1 Short-Leave unit; every 2 Short-Leave units
// (actual SL-status days + converted Lates + early-departure days) converts
// to 1 Half-Day penalty. See attendanceClassifier.service.js for the
// Late/Short-Leave windows this counts, and salaryCalculation.service.js /
// attendance.service.js for where this feeds payroll vs. is just surfaced
// for visibility on the attendance summary card.
function computeEffectiveUnits({ counts, lateFlagCount = 0, earlyDepartureCount = 0 }) {
  const lateToSLUnits = Math.floor((counts.L + lateFlagCount) / 2);
  const effectiveSLUnits = counts.SL + lateToSLUnits + earlyDepartureCount;
  const halfDayPenaltyUnits = Math.floor(effectiveSLUnits / 2);
  return { lateToSLUnits, effectiveSLUnits, halfDayPenaltyUnits };
}

module.exports = { computeEffectiveUnits };
