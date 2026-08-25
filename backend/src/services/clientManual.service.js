// Builds the per-client "manual" PDF — generated fresh on every download,
// never stored (no disk file, no Mongo blob), so it can never go stale. The
// document itself is assembled directly as an HTML string rather than
// through htmlRender.service.js#fillTemplate: that engine only supports one
// level of {#loop} sections, and this report needs genuinely nested
// repetition (months → meetings → decisions/action items/tasks) that a flat
// single-pass templating engine can't express. renderPdfFromHtml (the
// actual Puppeteer→PDF step) is still reused as-is — it just takes any HTML
// string, not necessarily one that went through fillTemplate.
const ApiError = require('../utils/ApiError');
const { renderPdfFromHtml } = require('./htmlRender.service');
const taskClientRepository = require('../repositories/taskClient.repository');
const companyEventService = require('./companyEvent.service');
const meetingRepository = require('../repositories/meeting.repository');
const clientCalendarRepository = require('../repositories/clientCalendar.repository');
const env = require('../config/env');

// One accent colour, matching the app's own indigo — a single fixed
// company theme, not per-client branding.
const ACCENT = '#4f46e5';
const INK = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

function fmtDate(date) {
  return date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function fmtDateTime(date) {
  return date ? new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function employeeName(ref) {
  return ref ? `${ref.firstName || ''} ${ref.lastName || ''}`.trim() : '';
}

function monthKeyOf(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Whichever teamHistory entry was open during this month — used when no
// ClientCalendar exists for that month to snapshot a team from directly.
function resolveTeamForMonth(teamHistory, year, month) {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 0, 23, 59, 59);
  const entry = (teamHistory || []).find((h) => {
    const start = new Date(h.startedAt).getTime();
    const end = h.endedAt ? new Date(h.endedAt).getTime() : Infinity;
    return start <= monthEnd && end >= monthStart;
  });
  return entry?.team;
}

function buildMeetingHtml(meeting) {
  const cancelledTag = meeting.status === 'cancelled' ? ' <span class="tag tag-red">Cancelled</span>' : '';
  const participants = (meeting.participants || []).map((p) => escapeHtml(employeeName(p))).join(', ') || '—';

  let momHtml = '<p class="muted">MOM not yet written.</p>';
  if (meeting.mom) {
    const decisions = (meeting.mom.decisions || []).map((d) => `<li>${escapeHtml(d)}</li>`).join('') || '<li class="muted">None recorded</li>';
    const actionItems = (meeting.mom.actionItems || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('') || '<li class="muted">None recorded</li>';
    const present = (meeting.mom.attendeesPresent || []).map((e) => escapeHtml(employeeName(e))).join(', ') || '—';
    const absent = (meeting.mom.attendeesAbsent || []).map((e) => escapeHtml(employeeName(e))).join(', ') || '—';
    momHtml = `
      <div class="mom">
        <p><strong>Summary:</strong> ${nl2br(meeting.mom.summary || '—')}</p>
        <p><strong>Present:</strong> ${present} &nbsp;&nbsp; <strong>Absent:</strong> ${absent}</p>
        <p class="label">Decisions</p><ul>${decisions}</ul>
        <p class="label">Action items</p><ul>${actionItems}</ul>
      </div>`;
  }

  const tasksHtml = (meeting.spawnedTasks || [])
    .map((st) => {
      const edits = (meeting.taskEdits || []).filter((e) => e.task?.toString() === st.task?._id?.toString());
      const editsHtml = edits
        .map((e) => `<li class="muted">Edited on ${fmtDateTime(e.changedAt)}${e.changedFields?.length ? ` (${escapeHtml(e.changedFields.join(', '))})` : ''}</li>`)
        .join('');
      const status = st.task?.status ? ` — <span class="muted">${escapeHtml(st.task.status.replace(/_/g, ' '))}</span>` : '';
      return `<li><strong>${escapeHtml(st.titleSnapshot)}</strong> <span class="muted">(${escapeHtml(st.kind)})</span>${status}${
        st.descriptionSnapshot ? `<br/><span class="muted">${escapeHtml(st.descriptionSnapshot)}</span>` : ''
      }${editsHtml ? `<ul>${editsHtml}</ul>` : ''}</li>`;
    })
    .join('');

  return `
    <div class="meeting">
      <p class="meeting-head">${fmtDateTime(meeting.scheduledAt)}${cancelledTag}${meeting.isLogged ? ' <span class="tag tag-grey">Logged</span>' : ''}</p>
      <p><strong>Participants:</strong> ${participants}</p>
      ${momHtml}
      ${tasksHtml ? `<p class="label">Tasks from this meeting</p><ul>${tasksHtml}</ul>` : ''}
    </div>`;
}

function wrapDocument(client, bodyHtml) {
  const title = client.brandName || client.name;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)} — Client Manual</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${INK}; margin: 0; }
  .page { padding: 4mm 2mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  h1 { color: ${ACCENT}; font-size: 26pt; margin: 0 0 2mm; }
  h2 { color: ${ACCENT}; font-size: 14pt; border-bottom: 1.5pt solid ${ACCENT}; padding-bottom: 1mm; margin: 6mm 0 3mm; }
  p { font-size: 10pt; line-height: 1.5; margin: 1.5mm 0; }
  .muted { color: ${MUTED}; }
  .label { font-weight: 700; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.5pt; color: ${ACCENT}; margin: 3mm 0 1mm; }
  ul { margin: 1mm 0 2mm; padding-left: 5mm; }
  li { font-size: 10pt; margin: 0.5mm 0; }
  table.info { width: 100%; border-collapse: collapse; margin: 2mm 0; }
  table.info th, table.info td { border: 0.5pt solid ${BORDER}; padding: 1.5mm 2mm; font-size: 9.5pt; text-align: left; }
  table.info th { background: #f1f5f9; color: ${ACCENT}; }
  .meeting { border-left: 2pt solid ${ACCENT}; padding-left: 3mm; margin: 3mm 0 5mm; }
  .meeting-head { font-weight: 700; }
  .mom { background: #f8fafc; border-radius: 2mm; padding: 2mm 3mm; margin: 2mm 0; }
  .switch-note { background: #eef2ff; border-radius: 2mm; padding: 2mm 3mm; font-style: italic; }
  .tag { display: inline-block; font-size: 8pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 3mm; color: #fff; }
  .tag-red { background: #ef4444; }
  .tag-grey { background: #94a3b8; }
  .cover-footer { position: fixed; bottom: 6mm; font-size: 8pt; color: ${MUTED}; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function buildManualHtml(clientId) {
  const client = await taskClientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  const [events, meetings, calendars] = await Promise.all([
    companyEventService.listForClient(clientId),
    meetingRepository.listForClient(clientId),
    clientCalendarRepository.listForClient(clientId),
  ]);

  // ---- Page 1 — profile ----
  const principals = (client.contacts || []).filter((c) => c.isPrimary);
  const nameList = (principals.length ? principals : client.contacts || []).map((c) => escapeHtml(c.name));
  const clientNames = nameList.length ? nameList.join(', ') : '—';

  const contactsRows =
    (client.contacts || [])
      .map(
        (c) =>
          `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.role || '')}</td><td>${escapeHtml(c.email || '')}</td><td>${escapeHtml(c.phone || '')}</td></tr>`
      )
      .join('') || '<tr><td colspan="4" class="muted">No contacts on file</td></tr>';

  const locationParts = [client.location?.addressLine, client.location?.city, client.location?.state, client.location?.country, client.location?.pincode].filter(Boolean);

  const datesHtml =
    events.map((e) => `<li><strong>${escapeHtml(e.name)}</strong> — ${fmtDate(e.date)}${e.notes ? ` (${escapeHtml(e.notes)})` : ''}</li>`).join('') ||
    '<li class="muted">None on file</li>';

  const page1 = `
    <section class="page">
      <h1>${escapeHtml(client.brandName || client.name)}</h1>
      <p class="muted">Client Manual — generated ${fmtDate(new Date())}</p>
      <h2>Client Name(s)</h2>
      <p>${clientNames}</p>
      <h2>Contact Info</h2>
      <table class="info"><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th></tr></thead><tbody>${contactsRows}</tbody></table>
      ${locationParts.length ? `<h2>Location</h2><p>${escapeHtml(locationParts.join(', '))}</p>` : ''}
      ${client.instagramHandle ? `<p><strong>Instagram:</strong> ${escapeHtml(client.instagramHandle)}</p>` : ''}
      ${client.website ? `<p><strong>Website:</strong> ${escapeHtml(client.website)}</p>` : ''}
      <h2>Important Dates</h2>
      <ul>${datesHtml}</ul>
      <h2>Expectations</h2>
      <p>${nl2br(client.expectations || '—')}</p>
    </section>`;

  // ---- Page 2 — about ----
  const page2 = `
    <section class="page">
      <h2>About the Brand</h2>
      <p>${nl2br(client.aboutBrand || '—')}</p>
      <h2>About the Client</h2>
      <p>${nl2br(client.aboutClient || '—')}</p>
    </section>`;

  // ---- Monthly history — union of months with a calendar, a meeting, or a
  // team-switch, walked chronologically ----
  const monthKeys = new Set();
  calendars.forEach((c) => monthKeys.add(`${c.year}-${String(c.month).padStart(2, '0')}`));
  meetings.forEach((m) => monthKeys.add(monthKeyOf(m.scheduledAt)));
  (client.teamHistory || []).forEach((h) => monthKeys.add(monthKeyOf(h.startedAt)));

  const monthsHtml = [...monthKeys]
    .sort()
    .map((key) => {
      const [y, m] = key.split('-').map(Number);
      const calendar = calendars.find((c) => c.year === y && c.month === m);
      const team = calendar?.team || resolveTeamForMonth(client.teamHistory, y, m);
      const monthMeetings = meetings.filter((mt) => monthKeyOf(mt.scheduledAt) === key);
      const switches = (client.teamHistory || []).filter((h) => monthKeyOf(h.startedAt) === key);

      const meetingsHtml = monthMeetings.map(buildMeetingHtml).join('') || '<p class="muted">No meetings this month.</p>';
      const switchesHtml = switches
        .map((s) => `<p class="switch-note">Team switched to <strong>${escapeHtml(s.team?.name || '—')}</strong> on ${fmtDate(s.startedAt)}.</p>`)
        .join('');

      return `
        <section class="page">
          <h2>${monthLabel(key)}</h2>
          <p><strong>Team:</strong> ${escapeHtml(team?.name || '—')}</p>
          ${switchesHtml}
          ${meetingsHtml}
        </section>`;
    })
    .join('');

  return { html: wrapDocument(client, page1 + page2 + monthsHtml), client };
}

async function generateManualPdf(clientId) {
  const { html } = await buildManualHtml(clientId);
  return renderPdfFromHtml(html, env.templatesHtmlDir);
}

module.exports = { buildManualHtml, generateManualPdf };
