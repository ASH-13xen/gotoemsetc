const { istInstant, istParts, istDaysInMonth } = require('./istDate');

// Client work — what each client is owed every month, and the tickets that
// deliver it (services/clientWork.service.js), the time people spend on them
// (services/workLog.service.js) and what that time costs against what the
// client pays (services/clientValue.service.js).

// Each kind of deliverable a client's month can commit to, and the work
// pipeline it follows (config/workPipelines.js). A festive story follows the
// story's steps.
const CONTENT_TYPES = [
  { key: 'reels', label: 'Reel', plural: 'Reels', pipeline: 'reel_v2' },
  { key: 'posts', label: 'Post', plural: 'Posts', pipeline: 'post_v2' },
  { key: 'stories', label: 'Story', plural: 'Stories', pipeline: 'story_v2' },
  { key: 'festiveStories', label: 'Festive story', plural: 'Festive stories', pipeline: 'story_v2' },
];
const CONTENT_TYPE_KEYS = CONTENT_TYPES.map((t) => t.key);
const typeOf = (key) => CONTENT_TYPES.find((t) => t.key === key);

// Time: a working day is the shift minus the lunch hour — 8 hours.
const HOURS_PER_DAY = 8;
const LUNCH = { start: { hour: 13, minute: 30 }, end: { hour: 14, minute: 30 } };
const DEFAULT_SHIFT = { start: '09:30', end: '18:30' };
// Kinds of time that isn't on a client's ticket — kept as overhead.
const OTHER_WORK = { meeting: 'Meeting', internal: 'Internal work', training: 'Training', other: 'Other' };

// "2026-11" ⇄ { year, month } — the month a plan, a ticket and a report are for.
const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
function parseMonth(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}
const currentMonthKey = (now = new Date()) => {
  const p = istParts(now);
  return monthKey(p.year, p.month);
};
function addMonths(key, n) {
  const { year, month } = parseMonth(key);
  const i = year * 12 + (month - 1) + n;
  return monthKey(Math.floor(i / 12), (i % 12) + 1);
}
const monthLabel = (key) => {
  const { year, month } = parseMonth(key);
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// "09:30" → { hour, minute }.
function hm(text, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : hm(fallback);
}

// When each of a month's `count` deliverables is due: spread evenly over the
// days left in the month (from `fromDay`), at the end of the working day,
// moved off a Sunday onto the Saturday before.
function spreadDueDates(key, count, { fromDay = 1, total = count, startIndex = 1 } = {}) {
  const { year, month } = parseMonth(key);
  const days = istDaysInMonth(year, month);
  const first = Math.min(Math.max(1, fromDay), days);
  const span = days - first + 1;
  const out = [];
  for (let i = startIndex; i < startIndex + count; i += 1) {
    let day = first + Math.max(0, Math.ceil((i * span) / total) - 1);
    day = Math.min(day, days);
    let due = istInstant(year, month, day, 18, 30);
    if (istParts(due).weekday === 0) {
      day = day > first ? day - 1 : Math.min(day + 1, days);
      due = istInstant(year, month, day, 18, 30);
    }
    out.push(due);
  }
  return out;
}

module.exports = {
  CONTENT_TYPES,
  CONTENT_TYPE_KEYS,
  typeOf,
  HOURS_PER_DAY,
  LUNCH,
  DEFAULT_SHIFT,
  OTHER_WORK,
  monthKey,
  parseMonth,
  currentMonthKey,
  addMonths,
  monthLabel,
  hm,
  spreadDueDates,
};
