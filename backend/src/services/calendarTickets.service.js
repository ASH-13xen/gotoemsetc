const ApiError = require('../utils/ApiError');
const CalendarItem = require('../models/CalendarItem');
const ClientCalendar = require('../models/ClientCalendar');
const Employee = require('../models/Employee');
const User = require('../models/User');
const calendarItemService = require('./calendarItem.service');
const clientCalendarRepository = require('../repositories/clientCalendar.repository');
const cmsWorkflow = require('./cmsWorkflow.service');
const cmsPipelines = require('../config/cmsPipelines');
const org = require('./orgHierarchy.service');
const { STEP_LABELS, actorLabel } = require('../utils/ticketPipeline');
const { CMS_STAGE_COLORS, CMS_CONTENT_TYPE } = require('../config/constants');

// The content calendar's work — daily stories, posts, reels, festive stories —
// shown as tickets without ever being raised again. Each keeps its own
// pipeline, colours and history; its buttons call the calendar's own
// advance/send back/reject (calendarItem.service.js), unchanged. Daily stories
// show as one ticket per month with a stub for each day.

const idOf = org.idOf;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);
const kindOf = (item) => cmsPipelines.pipelineKindFor(item);

function labelFor(item, key) {
  return STEP_LABELS[kindOf(item)]?.[key] || key;
}

function trailFor(item) {
  return cmsWorkflow.stepTrail(item).map((s, i) => ({
    ...s,
    label: labelFor(item, s.key),
    actorLabel: actorLabel(cmsPipelines.stepsFor(kindOf(item))[i]?.actor),
  }));
}

function codeFor(calendar, item) {
  const prefix = `CAL-${SHORT[calendar.month - 1]}${String(calendar.year).slice(2)}`;
  if (!item) return `${prefix}-STORIES`;
  const t = item.type === CMS_CONTENT_TYPE.FESTIVE_STORY ? 'FESTIVE' : item.type.toUpperCase();
  return `${prefix}-${t}${item.index}`;
}

// The Organisation chart team box linked to a calendar's work team.
function teamBoxFor(chart, calendar) {
  const workTeamId = idOf(calendar.team?._id || calendar.team);
  return org.teamBoxes(chart).find((t) => idOf(t.workTeam) === workTeamId) || null;
}

// Who the item waits on, from the chart — the same people the calendar's own
// check lets act (its team's role tags follow the chart), with the CEO and
// admin standing in for a vacant Team Lead.
async function waitingOn(item, teamBox, chart) {
  const step = cmsWorkflow.nextStepConfig(item);
  if (!step?.actor || item.isRejected || cmsWorkflow.isTerminal(item)) return { employeeIds: [], userIds: [] };
  return stepActors(item, step, teamBox, chart);
}

// Everyone on an item's pipeline — every step's people, not just the next.
async function pipelinePeople(item, teamBox, chart) {
  const employeeIds = new Set();
  const userIds = new Set();
  for (const step of cmsPipelines.stepsFor(kindOf(item))) {
    // eslint-disable-next-line no-await-in-loop
    const a = await stepActors(item, step, teamBox, chart);
    a.employeeIds.forEach((id) => employeeIds.add(id));
    a.userIds.forEach((id) => userIds.add(id));
  }
  return { employeeIds: [...employeeIds], userIds: [...userIds] };
}

async function stepActors(item, step, teamBox, chart) {
  if (!step?.actor) return { employeeIds: [], userIds: [] };
  const { actor } = step;
  const lead = () => org.leadActors(chart);
  if (actor.type === 'assignment') return { employeeIds: [idOf(item.assignments?.[actor.field])].filter(Boolean), userIds: [] };
  if (actor.type === 'team_role') {
    const ids = teamBox ? org.roleHolders(chart, teamBox._id, actor.role) : [];
    return { employeeIds: ids.length ? ids : teamBox ? org.teamHeads(chart, teamBox._id) : [], userIds: [] };
  }
  if (actor.type === 'global_team_lead') return lead();
  if (actor.type === 'smm_or_lead') {
    const smm = teamBox ? org.roleHolders(chart, teamBox._id, org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER) : [];
    const l = await lead();
    return { employeeIds: [...new Set([...smm, ...l.employeeIds])], userIds: l.userIds };
  }
  return { employeeIds: [], userIds: [] };
}

const isIn = (user, a) => (user.employeeLink && a.employeeIds.includes(idOf(user.employeeLink))) || a.userIds.includes(idOf(user.id));

function canSeeCalendar(user, teamBox, chart) {
  if (org.seesEveryone(user)) return true;
  if (!teamBox || !user.employeeLink) return false;
  return org.teamMembers(chart, teamBox._id).includes(idOf(user.employeeLink));
}

async function namesFor(items) {
  const ids = items.flatMap((i) => Object.values(i.assignments || {}).map(idOf)).filter(Boolean);
  const list = await Employee.find({ _id: { $in: [...new Set(ids)] } }).select('firstName lastName').lean();
  return new Map(list.map((e) => [idOf(e._id), nameOf(e)]));
}

function isOpenItem(item) {
  return !item.isRejected && !cmsWorkflow.isTerminal(item);
}

function itemCard(item, calendar, teamBox, waiting, now) {
  const kind = kindOf(item);
  const next = cmsWorkflow.nextStepConfig(item);
  return {
    kind: 'calendar',
    _id: idOf(item._id),
    code: codeFor(calendar, item),
    title: `${calendar.client?.name || 'Client'} — ${cmsWorkflow.labelFor(item)}${item.brief?.postingName ? ` · ${item.brief.postingName}` : ''}`,
    clientName: calendar.client?.name || '',
    pipeline: kind,
    pipelineName: item.type === CMS_CONTENT_TYPE.FESTIVE_STORY ? `Festive (${kind})` : kind[0].toUpperCase() + kind.slice(1),
    team: teamBox ? { _id: idOf(teamBox._id), title: teamBox.title } : null,
    dueAt: item.scheduledDate,
    stage: item.stage,
    stageLabel: labelFor(item, item.stage),
    color: cmsWorkflow.colorFor(item, now),
    trail: trailFor(item),
    isSentBack: Boolean(item.isSentBack),
    isRejected: Boolean(item.isRejected),
    isOverdue: isOpenItem(item) && new Date(item.scheduledDate) < now,
    status: item.isRejected ? 'rejected' : cmsWorkflow.isTerminal(item) ? 'completed' : 'open',
    waitingOnLabel: isOpenItem(item) && next ? actorLabel(next.actor) : null,
    nextStepLabel: isOpenItem(item) && next ? labelFor(item, next.key) : null,
    waitingCount: waiting.employeeIds.length + waiting.userIds.length,
  };
}

async function loadCalendars() {
  const calendars = await ClientCalendar.find({ isDeleted: false })
    .populate({ path: 'client', select: 'name' })
    .sort({ year: -1, month: -1 })
    .lean();
  return new Map(calendars.map((c) => [idOf(c._id), c]));
}

// scope: 'mine' (waiting on me), 'team' (my teams' calendars), 'all'.
async function list(user, { scope = 'mine', status = 'open' } = {}) {
  const chart = await org.loadChart();
  const calendars = await loadCalendars();
  const items = await CalendarItem.find({ isDeleted: false, calendar: { $in: [...calendars.keys()] } })
    .sort({ scheduledDate: 1, type: 1, index: 1 })
    .lean();
  const now = new Date();
  const cards = [];
  const storyGroups = new Map();

  for (const item of items) {
    const calendar = calendars.get(idOf(item.calendar));
    const teamBox = teamBoxFor(chart, calendar);
    if (scope !== 'mine' && !canSeeCalendar(user, teamBox, chart)) continue;
    if (scope === 'all' && !org.seesEveryone(user)) continue;
    // eslint-disable-next-line no-await-in-loop
    const waiting = await waitingOn(item, teamBox, chart);
    const mine = isIn(user, waiting);
    if (scope === 'mine' && !mine) continue;
    const itemStatus = item.isRejected ? 'rejected' : cmsWorkflow.isTerminal(item) ? 'completed' : 'open';

    if (item.type === CMS_CONTENT_TYPE.STORY) {
      const key = idOf(calendar._id);
      if (!storyGroups.has(key)) storyGroups.set(key, { calendar, teamBox, days: [], mine: false });
      const g = storyGroups.get(key);
      g.days.push({ ...item, _status: itemStatus, _mine: mine });
      g.mine = g.mine || mine;
      continue;
    }
    if (status !== 'all' && itemStatus !== status) continue;
    cards.push(itemCard(item, calendar, teamBox, waiting, now));
  }

  for (const g of storyGroups.values()) {
    const open = g.days.filter((d) => d._status === 'open');
    const groupStatus = open.length ? 'open' : 'completed';
    if (status !== 'all' && status !== groupStatus) continue;
    cards.push(storyGroupCard(g.calendar, g.teamBox, g.days, now));
  }
  return cards.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

function storyGroupCard(calendar, teamBox, days, now) {
  const open = days.filter((d) => isOpenItem(d));
  const firstOpen = open.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))[0];
  return {
    kind: 'stories',
    _id: idOf(calendar._id),
    code: codeFor(calendar),
    title: `Daily Stories — ${MONTHS[calendar.month - 1]} ${calendar.year} · ${calendar.client?.name || 'Client'}`,
    clientName: calendar.client?.name || '',
    pipeline: 'story',
    pipelineName: 'Story',
    team: teamBox ? { _id: idOf(teamBox._id), title: teamBox.title } : null,
    dueAt: firstOpen ? firstOpen.scheduledDate : days[days.length - 1]?.scheduledDate,
    color: firstOpen ? cmsWorkflow.colorFor(firstOpen, now) : CMS_STAGE_COLORS.story.lead_done,
    status: open.length ? 'open' : 'completed',
    days: days
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
      .map((d) => ({ _id: idOf(d._id), date: d.scheduledDate, stage: d.stage, stageLabel: labelFor(d, d.stage), color: cmsWorkflow.colorFor(d, now) })),
    doneCount: days.length - open.length,
    total: days.length,
    isOverdue: open.some((d) => new Date(d.scheduledDate) < now),
    trail: trailFor({ type: 'story', stage: firstOpen?.stage || 'lead_done' }),
  };
}

async function historyView(item) {
  const ids = (item.stageHistory || []).map((h) => idOf(h.byUser)).filter(Boolean);
  const users = await User.find({ _id: { $in: ids } }).select('username role employeeLink').populate('employeeLink', 'firstName lastName').lean();
  const byId = new Map(users.map((u) => [idOf(u._id), u]));
  const kind = kindOf(item);
  const type = { advance: 'advanced', send_back: 'sent_back', reject: 'rejected' };
  return (item.stageHistory || []).map((h, i) => {
    const u = byId.get(idOf(h.byUser));
    return {
      _id: `${idOf(item._id)}-${i}`,
      type: type[h.action] || h.action,
      at: h.at,
      byName: u ? (u.employeeLink ? nameOf(u.employeeLink) : u.username) : 'Someone',
      onBehalfOf: h.onBehalfOf || null,
      fromStage: h.from,
      toStage: h.to,
      fromLabel: labelFor(item, h.from),
      toLabel: labelFor(item, h.to),
      fromColor: CMS_STAGE_COLORS[kind]?.[h.from] || null,
      toColor: h.action === 'reject' ? CMS_STAGE_COLORS.rejected : h.action === 'send_back' ? CMS_STAGE_COLORS.sent_back : CMS_STAGE_COLORS[kind]?.[h.to] || null,
      note: h.note || '',
    };
  });
}

async function loadItemForUser(user, id) {
  const item = await calendarItemService.getItem(id);
  const calendar = await clientCalendarRepository.findById(idOf(item.calendar));
  if (!calendar) throw ApiError.notFound('Calendar not found');
  const chart = await org.loadChart();
  const teamBox = teamBoxFor(chart, calendar);
  const waiting = await waitingOn(item, teamBox, chart);
  if (!canSeeCalendar(user, teamBox, chart) && !isIn(user, waiting)) throw ApiError.forbidden("You don't have access to this item");
  return { item, calendar, teamBox, waiting, chart };
}

async function getItem(user, id) {
  const { item, calendar, teamBox, waiting } = await loadItemForUser(user, id);
  const now = new Date();
  const names = await namesFor([item]);
  const card = itemCard(item.toObject(), calendar, teamBox, waiting, now);
  const people = Object.fromEntries(Object.entries(item.assignments?.toObject?.() || {}).map(([k, v]) => [k, names.get(idOf(v)) || null]));
  const waitingNames = await Employee.find({ _id: { $in: waiting.employeeIds } }).select('firstName lastName').lean();
  return {
    ...card,
    brief: item.brief || {},
    people,
    waitingOn: waitingNames.map(nameOf),
    can: { act: cmsWorkflow.canActOnCurrentStep(user, item, calendar.team), sendBack: cmsWorkflow.canActOnCurrentStep(user, item, calendar.team) && item.stage !== 'created' },
    record: await historyView(item),
    calendar: { _id: idOf(calendar._id), month: calendar.month, year: calendar.year },
  };
}

async function getStories(user, calendarId) {
  const calendar = await clientCalendarRepository.findById(calendarId);
  if (!calendar) throw ApiError.notFound('Calendar not found');
  const chart = await org.loadChart();
  const teamBox = teamBoxFor(chart, calendar);
  const items = await CalendarItem.find({ calendar: calendar._id, type: CMS_CONTENT_TYPE.STORY, isDeleted: false }).sort({ scheduledDate: 1 });
  const now = new Date();
  const days = [];
  let anyMine = false;
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const waiting = await waitingOn(item, teamBox, chart);
    const mine = isIn(user, waiting);
    anyMine = anyMine || mine;
    days.push({
      _id: idOf(item._id),
      date: item.scheduledDate,
      stage: item.stage,
      stageLabel: labelFor(item, item.stage),
      color: cmsWorkflow.colorFor(item, now),
      isSentBack: Boolean(item.isSentBack),
      isRejected: Boolean(item.isRejected),
      isOverdue: isOpenItem(item) && new Date(item.scheduledDate) < now,
      waitingOnLabel: isOpenItem(item) ? actorLabel(cmsWorkflow.nextStepConfig(item)?.actor) : null,
      can: { act: cmsWorkflow.canActOnCurrentStep(user, item, calendar.team), sendBack: cmsWorkflow.canActOnCurrentStep(user, item, calendar.team) && item.stage !== 'created' },
      // eslint-disable-next-line no-await-in-loop
      record: await historyView(item),
    });
  }
  if (!canSeeCalendar(user, teamBox, chart) && !anyMine) throw ApiError.forbidden("You don't have access to these stories");
  const card = storyGroupCard(calendar.toObject(), teamBox, items.map((i) => i.toObject()), now);
  return { ...card, days };
}

async function act(user, id, action, body) {
  await loadItemForUser(user, id);
  if (action === 'advance') await calendarItemService.advance(id, user, body);
  else if (action === 'send-back') await calendarItemService.sendBack(id, user, body);
  else if (action === 'reject') await calendarItemService.reject(id, user, body);
  else throw ApiError.badRequest('Unknown action');
  return getItem(user, id);
}

// How many calendar items wait on this person, for the dashboard card.
async function countMine(user) {
  return (await list(user, { scope: 'mine', status: 'open' })).length;
}

module.exports = {
  list,
  getItem,
  getStories,
  act,
  countMine,
  // for the task calendar
  loadCalendars,
  teamBoxFor,
  waitingOn,
  pipelinePeople,
  isIn,
  labelFor,
  codeFor,
  isOpenItem,
  MONTHS,
};
