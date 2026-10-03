const path = require('node:path');
const { renderPdfFromHtml } = require('./htmlRender.service');
const weeklyCalendarService = require('./weeklyCalendar.service');
const { WEEKLY_GRID } = require('../config/constants');

// Renders someone's week in the exact layout of the CEO's weekly planner
// PDF: dates across the top, 30-minute rows down the side, merged cells for
// longer meetings, the same meeting on neighbouring days merged sideways,
// "NA" for free time and a LUNCH TIME band. The early (6:30–9:00) and late
// (6:30–8:30 pm) stretches collapse to a single row when they're empty —
// just like the template.

const TEMPLATE_DIR = path.join(__dirname, '../../templates/html');
const COLORS = {
  team: '#d9ead3',
  sales: '#c9daf8',
  hr: '#fce5cd',
  client: '#e6b8af',
  event: '#fff2cc',
  training: '#d0e0e3',
  admin: '#ead1dc',
  other: '#f3f3f3',
  personal: '#e9e3f5',
  busy: '#e5e7eb',
};

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// 12-hour clock without am/pm, as the template writes it ("01:30").
function clock(min) {
  const h = Math.floor(min / 60) % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function ddmmyy(day) {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function buildRows(events) {
  const { START, END, SLOT } = WEEKLY_GRID;
  const busyIn = (a, b) => events.some((e) => e.startMin < b && a < e.endMin);
  const rows = [];
  for (let t = START; t < END; t += SLOT) {
    if (t === START && !busyIn(390, 540)) {
      rows.push({ start: 390, end: 540 });
      t = 540 - SLOT;
      continue;
    }
    if (t === 1110 && !busyIn(1110, END)) {
      rows.push({ start: 1110, end: END });
      break;
    }
    rows.push({ start: t, end: t + SLOT });
  }
  return rows;
}

function eventCell(e) {
  if (e.busy) return { key: `busy:${e.startMin}:${e.endMin}`, bg: COLORS.busy, html: '<b>BUSY</b>' };
  const segments = (e.segments || [])
    .map((s) => `<div class="seg">${clock(s.startMin)}-${clock(s.endMin)}- <b>${esc((s.user?.name || s.label || '').toUpperCase())}</b>${s.user && s.label ? ` (${esc(s.label)})` : ''}</div>`)
    .join('');
  const people = e.attendees?.filter((a) => a.status === 'accepted').length ?? 0;
  return {
    key: `${e.title}|${e.startMin}|${e.endMin}|${e.category}|${e.isPersonal}`,
    bg: e.isPersonal ? COLORS.personal : COLORS[e.category] || COLORS.other,
    html: `<b>${esc(e.title.toUpperCase())}</b>${e.isPersonal ? '<div class="sub">(PERSONAL)</div>' : ''}${
      e.location ? `<div class="sub">${esc(e.location)}</div>` : ''
    }${segments}${people ? `<div class="sub">${people + 1} people</div>` : ''}`,
  };
}

function buildHtml(week) {
  const { LUNCH_START, LUNCH_END } = WEEKLY_GRID;
  const shown = week.events.filter((e) => e.busy || e.myRole === 'host' || e.myRole === 'accepted');
  const rows = buildRows(shown);
  const holidayByDay = new Map(week.holidays.map((h) => [h.day, h]));
  const leave = new Set(week.leaveDays);

  // matrix[row][day] = cell | 'covered'
  const matrix = rows.map(() => week.days.map(() => null));
  week.days.forEach((day, d) => {
    rows.forEach((row, r) => {
      if (matrix[r][d] === 'covered') return;
      if (row.start === LUNCH_START) {
        const span = rows.filter((x) => x.start >= LUNCH_START && x.start < LUNCH_END).length;
        matrix[r][d] = { key: 'lunch', bg: '#fff2cc', html: '<b>LUNCH TIME</b>', rowspan: span, lunch: true };
        for (let k = 1; k < span; k += 1) matrix[r + k][d] = 'covered';
        return;
      }
      const e = shown.find((x) => x.day === day && x.startMin === row.start);
      if (e) {
        const span = rows.filter((x) => x.start >= e.startMin && x.start < e.endMin).length;
        matrix[r][d] = { ...eventCell(e), rowspan: span };
        for (let k = 1; k < span; k += 1) matrix[r + k][d] = 'covered';
        return;
      }
      const label = leave.has(day) ? 'ON LEAVE' : holidayByDay.get(day)?.type === 'holiday' ? 'HOLIDAY' : 'NA';
      matrix[r][d] = { key: null, bg: label === 'NA' ? '#fff' : '#f1f5f9', html: label === 'NA' ? 'NA' : `<b>${label}</b>`, rowspan: 1 };
    });
  });

  // Same meeting on neighbouring days → one wide cell, like the template.
  const body = rows
    .map((row, r) => {
      let cells = '';
      for (let d = 0; d < week.days.length; d += 1) {
        const cell = matrix[r][d];
        if (cell === 'covered' || cell?.skip) continue;
        let colspan = 1;
        while (
          cell.key &&
          !cell.lunch &&
          d + colspan < week.days.length &&
          matrix[r][d + colspan] !== 'covered' &&
          matrix[r][d + colspan]?.key === cell.key &&
          matrix[r][d + colspan].rowspan === cell.rowspan
        ) {
          matrix[r][d + colspan].skip = true;
          // The merged cells below it are covered by this one already.
          colspan += 1;
        }
        cells += `<td rowspan="${cell.rowspan}" colspan="${colspan}" style="background:${cell.bg}">${cell.html}</td>`;
      }
      return `<tr><td class="t">${clock(row.start)}</td><td class="t">${clock(row.end)}</td>${cells}</tr>`;
    })
    .join('');

  const head = week.days
    .map((day) => {
      const h = holidayByDay.get(day);
      return `<th>${ddmmyy(day)}${h ? `<div class="hol">${esc(h.label)}</div>` : ''}</th>`;
    })
    .join('');
  const dows = week.days.map((day) => `<th>${new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}</th>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  * { box-sizing: border-box; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; margin: 0; color: #111; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #333; text-align: center; vertical-align: middle; font-size: 9.5px; padding: 4px 3px; line-height: 1.25; }
  th { font-size: 10.5px; }
  td.t { width: 46px; font-size: 9.5px; }
  th.who { width: 92px; background: #c27ba0; color: #111; font-size: 8.5px; }
  .sub { font-size: 8px; color: #333; margin-top: 2px; }
  .seg { font-size: 8px; text-align: left; margin-top: 1px; }
  .hol { font-size: 7.5px; font-weight: 600; color: #b45309; }
</style></head><body>
<table>
  <tr><th class="who" colspan="2" rowspan="2">${esc(week.person.name.toUpperCase())}<br/>WEEKLY CALENDAR</th>${head}</tr>
  <tr>${dows}</tr>
  ${body}
</table></body></html>`;
}

async function renderWeekPdf(viewer, { start, userId }) {
  const week = await weeklyCalendarService.getWeek(viewer, { start, userId });
  const html = buildHtml(week);
  const pdf = await renderPdfFromHtml(html, TEMPLATE_DIR, { landscape: true });
  return { pdf, filename: `Weekly Calendar - ${week.person.name} - ${ddmmyy(week.start).replace(/\//g, '-')}.pdf` };
}

module.exports = { renderWeekPdf, buildHtml };
