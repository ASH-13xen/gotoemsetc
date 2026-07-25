// At most 2 Lates and 2 Short-Leave units count at face value in a period;
// everything past the cap demotes into the next-worse category one-for-one.
// Excess Lates (status L + manual isLate flag, combined) become Short-Leave
// units; excess Short-Leave units (actual SL-status days + demoted Lates +
// early-departure days) become Half-Day units. See
// attendanceClassifier.service.js for the Late/Short-Leave windows this
// counts, and salaryCalculation.service.js / attendance.service.js for
// where this feeds payroll vs. is just surfaced for visibility on the
// attendance summary card.
const LATE_CAP = 2;
const SL_CAP = 2;

function computeEffectiveUnits({ counts, lateFlagCount = 0, earlyDepartureCount = 0 }) {
  const totalLateRaw = counts.L + lateFlagCount;
  const cappedLateUnits = Math.min(totalLateRaw, LATE_CAP);
  const lateToSLUnits = Math.max(totalLateRaw - LATE_CAP, 0);

  const effectiveSLUnits = counts.SL + lateToSLUnits + earlyDepartureCount;
  const cappedSLUnits = Math.min(effectiveSLUnits, SL_CAP);
  const halfDayPenaltyUnits = Math.max(effectiveSLUnits - SL_CAP, 0);

  return { cappedLateUnits, lateToSLUnits, effectiveSLUnits, cappedSLUnits, halfDayPenaltyUnits };
}

module.exports = { computeEffectiveUnits, LATE_CAP, SL_CAP };
