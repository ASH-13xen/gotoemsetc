const ApiError = require('../utils/ApiError');
const clientCalendarRepository = require('../repositories/clientCalendar.repository');
const calendarItemRepository = require('../repositories/calendarItem.repository');
const cmsWorkflow = require('./cmsWorkflow.service');
const istDate = require('../utils/istDate');
const { CMS_CONTENT_TYPE, CMS_CONTENT_TYPE_QUOTA_KEY } = require('../config/constants');

// Month-end fulfilment, per client per month.
//
// Frozen at close rather than recomputed on every read: the report answers
// "what did we actually deliver in August", and an edit made in September
// must not be able to rewrite that answer. Before close it's computed live so
// the month can be watched in progress; after close the stored copy is
// returned verbatim.
function buildReport(calendar, items) {
  const live = items.filter((i) => !i.isDeleted);
  const daysInMonth = istDate.istDaysInMonth(calendar.year, calendar.month);

  const perType = Object.values(CMS_CONTENT_TYPE).map((type) => {
    const ofType = live.filter((i) => i.type === type);
    const published = ofType.filter((i) => cmsWorkflow.isTerminal(i));
    const quota = calendar.quotas[CMS_CONTENT_TYPE_QUOTA_KEY[type]];

    // On time means published by the day it was scheduled for — the 18:30 IST
    // deadline the task carried.
    const onTime = published.filter((i) => i.publishedAt && new Date(i.publishedAt) <= new Date(i.scheduledDate));

    // Daily stories are committed as a per-day rate, so their denominator is
    // days in the month, not a monthly total.
    const isStory = type === CMS_CONTENT_TYPE.STORY;
    const scheduled = isStory
      ? new Set(ofType.map((i) => istDate.istDateKey(i.scheduledDate))).size
      : ofType.length;
    const publishedCount = isStory
      ? new Set(published.map((i) => istDate.istDateKey(i.scheduledDate))).size
      : published.length;

    return {
      type,
      committedLabel: isStory ? `${quota.label}/day over ${daysInMonth} days` : quota.label,
      scheduled,
      published: publishedCount,
      onTime: onTime.length,
      late: published.length - onTime.length,
      unpublished: ofType.length - published.length,
    };
  });

  // Rejections are read off the append-only stage history rather than the
  // current state — an item rejected twice and then published still has to
  // count as two rejections.
  const rejectionsByStage = {};
  for (const item of live) {
    for (const entry of item.stageHistory || []) {
      if (entry.action !== 'reject') continue;
      rejectionsByStage[entry.from] = (rejectionsByStage[entry.from] || 0) + 1;
    }
  }

  // Mean hours from first submission to publication, across items that got
  // all the way there. Null when nothing completed the pipeline — a zero
  // would read as "instant", which is a different claim.
  const turnarounds = live
    .filter((i) => i.submittedAt && i.publishedAt)
    .map((i) => (new Date(i.publishedAt) - new Date(i.submittedAt)) / (1000 * 60 * 60));
  const avgApprovalHours = turnarounds.length
    ? Number((turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length).toFixed(1))
    : null;

  const neverPublished = live
    .filter((i) => !cmsWorkflow.isTerminal(i))
    .map((i) => i._id);

  return {
    generatedAt: new Date(),
    perType,
    rejectionsByStage,
    avgApprovalHours,
    neverPublished,
  };
}

async function getOrBuildReport(calendarId) {
  const calendar = await clientCalendarRepository.findById(calendarId);
  if (!calendar) throw ApiError.notFound('Calendar not found');

  // Closed months return the frozen snapshot; open ones are computed live.
  if (calendar.closedAt && calendar.report) {
    return { ...calendar.report.toObject?.() ?? calendar.report, frozen: true, calendar };
  }

  const items = await calendarItemRepository.listForCalendar(calendarId);
  return { ...buildReport(calendar, items), frozen: false, calendar };
}

// Freezes the month. Idempotent — closing an already-closed month returns it
// untouched rather than regenerating, which is the whole point of freezing.
async function closeMonth(calendarId) {
  const calendar = await clientCalendarRepository.findById(calendarId);
  if (!calendar) throw ApiError.notFound('Calendar not found');
  if (calendar.closedAt) return calendar;

  const items = await calendarItemRepository.listForCalendar(calendarId);
  const report = buildReport(calendar, items);

  return clientCalendarRepository.updateById(calendarId, { report, closedAt: new Date() });
}

// Sweeps every still-open calendar for a month and freezes it. Run from the
// close-month job on the 1st, for the month that just ended.
async function closeMonthForAll(year, month) {
  const open = await clientCalendarRepository.listOpenForMonth(year, month);
  const results = [];
  for (const calendar of open) {
    results.push(await closeMonth(calendar._id));
  }
  return results;
}

module.exports = { buildReport, getOrBuildReport, closeMonth, closeMonthForAll };
