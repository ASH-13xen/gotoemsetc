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

// Tags each event, in date order, with whether it fell inside the free cap
// or overflowed into the next tier — the same boundary computeEffectiveUnits
// draws with a bare Math.min/max, just walked event-by-event so each one
// carries its own outcome for display.
function tagOutcome(events, cap, overflowLabel) {
  return events.map((event, index) => ({
    ...event,
    outcome: index < cap ? 'counted' : 'converted',
    outcomeLabel: index < cap ? 'Counted normally' : overflowLabel,
  }));
}

// Every date-tagged event that can contribute a unit to the Late -> Short
// Leave -> Half Day escalation, cascaded the same way the numeric-only
// version below does — but keeping each event's date and a plain-English
// reason attached throughout, so a generated salary slip can show an
// employee exactly which dates produced a deduction and why, instead of
// just a final count. See salarySlip.service.js#buildDeductionBreakdown.
//
// Each `*Dates` input is an array of Dates (one entry per contributing
// record) — lateStatusDates/slStatusDates/halfDayStatusDates come from a
// record's literal `status`; lateFlagDates/earlyDepartureDates come from the
// independent isLate/earlyDeparture flags, which can co-occur with any
// status (including the same date appearing in more than one list).
function computeEffectiveUnitsBreakdown({
  lateStatusDates = [],
  lateFlagDates = [],
  slStatusDates = [],
  earlyDepartureDates = [],
  halfDayStatusDates = [],
}) {
  const byDate = (a, b) => a.date.getTime() - b.date.getTime();

  const lateEvents = tagOutcome(
    [
      ...lateStatusDates.map((date) => ({ date, reason: 'Late arrival' })),
      ...lateFlagDates.map((date) => ({ date, reason: 'Marked late' })),
    ].sort(byDate),
    LATE_CAP,
    `Beyond the free ${LATE_CAP} Lates this period — converted to a Short Leave unit`
  );
  const lateOverflowEvents = lateEvents.filter((e) => e.outcome === 'converted');

  const slEvents = tagOutcome(
    [
      ...slStatusDates.map((date) => ({ date, reason: 'Short Leave' })),
      ...earlyDepartureDates.map((date) => ({ date, reason: 'Left early' })),
      ...lateOverflowEvents.map(({ date }) => ({ date, reason: 'Late (3rd+) demoted to Short Leave' })),
    ].sort(byDate),
    SL_CAP,
    `Beyond the free ${SL_CAP} Short-Leave units this period — converted to a Half Day deduction`
  );
  const slOverflowEvents = slEvents.filter((e) => e.outcome === 'converted');

  const halfDayEvents = [
    ...halfDayStatusDates.map((date) => ({ date, reason: 'Half Day' })),
    ...slOverflowEvents.map(({ date }) => ({ date, reason: 'Short Leave (3rd+) converted to Half Day' })),
  ].sort(byDate);

  return {
    lateEvents,
    slEvents,
    halfDayEvents,
    cappedLateUnits: Math.min(lateEvents.length, LATE_CAP),
    lateToSLUnits: lateOverflowEvents.length,
    effectiveSLUnits: slEvents.length,
    cappedSLUnits: Math.min(slEvents.length, SL_CAP),
    halfDayPenaltyUnits: slOverflowEvents.length,
  };
}

// Numeric-only counterpart, for callers (attendance.service.js's lifetime
// summary card) that only need the totals, not which specific dates
// produced them — same cap/overflow arithmetic as the breakdown above,
// just over bare counts instead of date-tagged events.
function computeEffectiveUnits({ counts, lateFlagCount = 0, earlyDepartureCount = 0 }) {
  const totalLateRaw = counts.L + lateFlagCount;
  const cappedLateUnits = Math.min(totalLateRaw, LATE_CAP);
  const lateToSLUnits = Math.max(totalLateRaw - LATE_CAP, 0);

  const effectiveSLUnits = counts.SL + lateToSLUnits + earlyDepartureCount;
  const cappedSLUnits = Math.min(effectiveSLUnits, SL_CAP);
  const halfDayPenaltyUnits = Math.max(effectiveSLUnits - SL_CAP, 0);

  return { cappedLateUnits, lateToSLUnits, effectiveSLUnits, cappedSLUnits, halfDayPenaltyUnits };
}

module.exports = { computeEffectiveUnits, computeEffectiveUnitsBreakdown, LATE_CAP, SL_CAP };
