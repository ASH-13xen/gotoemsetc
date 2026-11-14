const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const Ticket = require('../models/Ticket');
const TicketEvent = require('../models/TicketEvent');
const TicketRepeat = require('../models/TicketRepeat');
const Employee = require('../models/Employee');
const User = require('../models/User');
const counterRepository = require('../repositories/counter.repository');
const notificationService = require('./notification.service');
const notifyRecipients = require('./notifyRecipients.service');
const org = require('./orgHierarchy.service');
const pipe = require('../utils/ticketPipeline');
const wp = require('../config/workPipelines');
const { hasRole } = require('../utils/roles');
const { ROLE_LABEL, ROLE_RANK } = require('../config/access');
const {
  TICKET_PIPELINE: P,
  TICKET_STATUS,
  TICKET_EVENT: EV,
  TICKET_PRIORITY,
  NOTIFICATION_TYPES: NT,
  USER_ROLES,
  ORG_NODE_KIND,
} = require('../config/constants');

// Task Management, as tickets. Someone raises a ticket for a person in their
// own box or below (orgHierarchy.service.js); it follows one pipeline
// (utils/ticketPipeline.js), shows to whoever must act on its current step,
// and takes that step's colour. Every action is written to the ticket's
// permanent record (TicketEvent). When it reaches its last step — or is
// rejected — it is submitted to the CEO's section. In-app notifications
// only; tickets never send email.

const idOf = org.idOf;
const PIPELINE_NAME = {
  simple: 'Simple',
  story: 'Story (old)',
  post: 'Post (old)',
  reel: 'Reel (old)',
  custom: 'Custom',
  ...Object.fromEntries(Object.entries(wp.PIPELINES).map(([k, p]) => [k, p.name])),
};
const codeOf = (number) => `TKT-${String(number).padStart(4, '0')}`;
const isAdmin = (user) => hasRole(user, USER_ROLES.ADMIN);
const isCeo = (user) => hasRole(user, USER_ROLES.CEO);
const seesEveryone = (user) => org.seesEveryone(user);

// ---- names ----------------------------------------------------------------

const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);

async function peopleMap(ids) {
  const list = await Employee.find({ _id: { $in: [...new Set(ids.filter(Boolean).map(idOf))] } })
    .select('firstName lastName designation employeeCode status')
    .lean();
  return new Map(list.map((e) => [idOf(e._id), e]));
}

async function userMap(ids) {
  const list = await User.find({ _id: { $in: [...new Set(ids.filter(Boolean).map(idOf))] } })
    .select('username role employeeLink')
    .populate('employeeLink', 'firstName lastName')
    .lean();
  return new Map(list.map((u) => [idOf(u._id), u]));
}

const userName = (u) => (u?.employeeLink ? nameOf(u.employeeLink) : u ? `${ROLE_LABEL[u.role] || u.username} login` : null);

// The post someone acts as when they raise, comment or edit — their most
// senior role, or the box they hold ("Content Manager · ALPHA").
function postLabel(user, chart) {
  const roles = (user.roles || [user.role]).filter((r) => r && r !== USER_ROLES.WORKER);
  if (roles.length) {
    const top = roles.sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0))[0];
    return ROLE_LABEL[top] || top;
  }
  const employeeId = idOf(user.employeeLink);
  const box = chart.nodes.find((n) => n.kind === ORG_NODE_KIND.TEAM_ROLE && (n.assignees || []).map(idOf).includes(employeeId));
  if (box) return `${box.title} · ${chart.byId.get(idOf(box.parent))?.title || ''}`.trim();
  return 'Employee';
}

// ---- who acts on a step -------------------------------------------------------

// The people a step waits on. `fallback` says the step's own box is vacant
// and someone above is standing in (the CEO for a vacant Team Lead, the team
// head for a team with no Social Media Manager).
async function actorsFor(ticket, step, chart) {
  const none = { employeeIds: [], userIds: [], fallback: null };
  const actor = step?.actor;
  if (!actor) return none;
  const one = (id) => ({ employeeIds: id ? [idOf(id)] : [], userIds: [], fallback: null });

  if (actor.type === 'raised_for') return one(ticket.raisedFor);
  if (actor.type === 'raiser') {
    return { employeeIds: ticket.raisedByEmployee ? [idOf(ticket.raisedByEmployee)] : [], userIds: [idOf(ticket.raisedBy)], fallback: null };
  }
  if (actor.type === 'direct') return one((ticket.customSteps || []).find((s) => s.key === actor.stepKey)?.assignee);
  if (actor.type === 'assignment') return one(ticket.assignments?.[actor.field] || (actor.field === 'smm' ? ticket.smm : null));
  if (actor.type === 'approver') {
    if (ticket.approver) return one(ticket.approver);
    if (ticket.approverUser) return { employeeIds: [], userIds: [idOf(ticket.approverUser)], fallback: null };
    return { employeeIds: ticket.raisedByEmployee ? [idOf(ticket.raisedByEmployee)] : [], userIds: [idOf(ticket.raisedBy)], fallback: null };
  }
  // Work pipelines: the team's Content Manager (planner only), the Team Lead, the CEO.
  if (actor.type === 'planner' || actor.type === 'tl_ceo') {
    const leads = await org.teamLeads(chart);
    const ceo = await org.ceoAndAdmin(chart, { includeAdmin: false });
    const cms =
      actor.type === 'planner'
        ? [...(ticket.team ? org.roleHolders(chart, ticket.team, org.TEAM_ROLE.CONTENT_MANAGER) : []), ...(ticket.assignments?.contentManager ? [idOf(ticket.assignments.contentManager)] : [])]
        : [];
    return { employeeIds: [...new Set([...cms, ...leads.employeeIds, ...ceo.employeeIds])], userIds: [...new Set([...leads.userIds, ...ceo.userIds])], fallback: null };
  }

  const lead = () => org.leadActors(chart);
  const teamRole = async (role, label) => {
    // The ticket's own SMM, when it names one.
    if (role === org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER && ticket.smm) return { employeeIds: [idOf(ticket.smm)], userIds: [], fallback: null };
    const ids = org.roleHolders(chart, ticket.team, role);
    if (ids.length) return { employeeIds: ids, userIds: [], fallback: null };
    const heads = org.teamHeads(chart, ticket.team);
    if (heads.length) return { employeeIds: heads, userIds: [], fallback: label };
    const top = await org.ceoAndAdmin(chart);
    return { ...top, fallback: label };
  };

  if (actor.type === 'team_role') return teamRole(actor.role, pipe.actorLabel(actor, ticket));
  if (actor.type === 'global_team_lead') return lead();
  if (actor.type === 'smm_or_lead') {
    const smm = ticket.smm ? [idOf(ticket.smm)] : org.roleHolders(chart, ticket.team, org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER);
    const l = await lead();
    return { employeeIds: [...new Set([...smm, ...l.employeeIds])], userIds: l.userIds, fallback: smm.length ? null : l.fallback };
  }
  return none;
}

const isIn = (user, actors) =>
  (user.employeeLink && actors.employeeIds.includes(idOf(user.employeeLink))) || actors.userIds.includes(idOf(user.id));

function isOpen(ticket) {
  return ticket.status === TICKET_STATUS.OPEN && !ticket.isRejected && !pipe.isTerminal(ticket);
}

// Waiting in a lineup, on hold, or scheduled with its posting date still to
// come — nobody holds it. Null when someone does.
function parkedNow(ticket, now = new Date()) {
  if (!ticket.parkedIn) return null;
  if (ticket.parkedUntil && new Date(ticket.parkedUntil) <= now) return null;
  return ticket.parkedIn;
}

const isTeamLead = (user) => hasRole(user, USER_ROLES.TEAM_LEAD);
// The team's Content Manager, the Team Lead, the CEO and admin: start a
// locked ticket, set its due date, change anyone on it, move it out of a
// lineup, put it on hold. The Team Lead, CEO and admin may pick people from
// any team; a Content Manager from their own.
function managesTicket(user, ticket, chart) {
  if (seesEveryone(user) || isTeamLead(user)) return true;
  if (!user.employeeLink || !ticket.team) return false;
  return org.roleHolders(chart, ticket.team, org.TEAM_ROLE.CONTENT_MANAGER).includes(idOf(user.employeeLink));
}
const picksFromAnyTeam = (user) => seesEveryone(user) || isTeamLead(user);

// May this person act on the step the ticket is waiting on? Its own people,
// or the CEO/admin for any step.
async function actingContext(user, ticket, chart) {
  if (!isOpen(ticket) || ticket.locked) return { canAct: false };
  const step = pipe.nextStep(ticket);
  if (!step) return { canAct: false };
  // A ticket in a lineup waits — except the calendar lineup, which is left by
  // scheduling it: that step can be done while it waits there, by its Content
  // Manager, the team's, the Team Lead, the CEO or admin.
  const parked = parkedNow(ticket);
  const scheduling = parked === 'calendar' && Boolean(step.needsDate);
  if (parked && !scheduling) return { canAct: false };
  const actors = await actorsFor(ticket, step, chart);
  const managing = scheduling && !isIn(user, actors) && !seesEveryone(user) && managesTicket(user, ticket, chart);
  const natural = isIn(user, actors) || managing;
  const force = !natural && seesEveryone(user);
  if (!natural && !force) return { canAct: false, actors, step };
  const label = pipe.actorLabel(step.actor, ticket);
  const teamSuffix = ['team_role', 'smm_or_lead'].includes(step.actor?.type) && ticket.teamName ? ` · ${ticket.teamName}` : '';
  let actingAs = `${label}${teamSuffix}`;
  let onBehalfOf = null;
  if (managing) {
    actingAs = isTeamLead(user) ? 'Team Lead' : `Content Manager${ticket.teamName ? ` · ${ticket.teamName}` : ''}`;
  } else if (force) {
    actingAs = isCeo(user) ? 'CEO' : 'Admin';
    onBehalfOf = label;
  } else if (actors.fallback && !(actors.fallback === 'Team Lead' && hasRole(user, USER_ROLES.TEAM_LEAD))) {
    actingAs = `${postLabel(user, chart)} (for the vacant ${actors.fallback})`;
  }
  return { canAct: true, actors, step, natural, actingAs, onBehalfOf };
}

// ---- visibility -------------------------------------------------------------

// Everyone a ticket concerns: who raised it, who it's for, and every step's
// people.
async function involvedEmployees(ticket, chart) {
  const ids = new Set([idOf(ticket.raisedFor), idOf(ticket.raisedByEmployee)].filter(Boolean));
  for (const step of pipe.stepsFor(ticket)) {
    if (!step.actor) continue;
    // eslint-disable-next-line no-await-in-loop
    const a = await actorsFor(ticket, step, chart);
    a.employeeIds.forEach((id) => ids.add(id));
  }
  return ids;
}

// Who raised it, everyone on it, the people above them, and CEO/admin.
async function canView(user, ticket, chart, raisable) {
  if (seesEveryone(user)) return true;
  if (idOf(ticket.raisedBy) === idOf(user.id)) return true;
  const involved = await involvedEmployees(ticket, chart);
  if (user.employeeLink && involved.has(idOf(user.employeeLink))) return true;
  const below = raisable || (await org.raisableFor(user, chart));
  return [...involved].some((id) => below.has(id) && id !== idOf(user.employeeLink));
}

const canEdit = (user, ticket) => isOpen(ticket) && (idOf(ticket.raisedBy) === idOf(user.id) || seesEveryone(user));

// ---- the permanent record -----------------------------------------------------

async function record(ticket, type, user, fields = {}) {
  let byName = null;
  if (user) {
    const u = (await userMap([user.id])).get(idOf(user.id));
    byName = userName(u) || user.displayName || user.username;
  }
  return TicketEvent.create({
    ticket: ticket._id,
    type,
    byUser: user ? user.id : null,
    byEmployee: user?.employeeLink || null,
    byName: byName || 'System',
    ...fields,
  });
}

// ---- notifications (in-app only) ---------------------------------------------

async function notify(userIds, employeeIds, { type, title, message, ticket }, exceptUserId) {
  const fromEmployees = await notifyRecipients.resolveUserIdsForEmployees(employeeIds || []);
  const all = [...(userIds || []), ...fromEmployees].map(idOf).filter((id) => id && id !== idOf(exceptUserId));
  if (!all.length) return;
  await notificationService.createForUsers(all, { type, title, message, ticket: ticket._id });
}

async function notifyWaiting(ticket, chart, actorUserId, type, title, message) {
  const step = pipe.nextStep(ticket);
  if (!step) return;
  const actors = await actorsFor(ticket, step, chart);
  await notify(actors.userIds, actors.employeeIds, { type, title, message, ticket }, actorUserId);
}

// ---- views --------------------------------------------------------------------

function stepPeopleNames(actors, people, users) {
  return [
    ...actors.employeeIds.map((id) => nameOf(people.get(id))).filter(Boolean),
    ...actors.userIds.map((id) => users.get(id)).filter((u) => u && !u.employeeLink).map(userName),
  ];
}

async function toView(user, ticket, chart, { withRecord = false } = {}) {
  const now = new Date();
  const steps = pipe.stepsFor(ticket);
  const stepActors = [];
  for (const step of steps) {
    // eslint-disable-next-line no-await-in-loop
    stepActors.push(await actorsFor(ticket, step, chart));
  }
  const allEmployeeIds = [ticket.raisedFor, ticket.raisedByEmployee, ticket.smm, ticket.approver, ...Object.values(ticket.assignments || {}), ...stepActors.flatMap((a) => a.employeeIds)];
  const people = await peopleMap(allEmployeeIds);
  const users = await userMap([ticket.raisedBy, ticket.ceoReviewedBy, ticket.approverUser, ...stepActors.flatMap((a) => a.userIds), ...(ticket.links || []).map((l) => l.addedBy)]);
  const ctx = await actingContext(user, ticket, chart);
  const nextIdx = pipe.currentIndex(ticket) + 1;
  const waiting = isOpen(ticket) && stepActors[nextIdx] ? stepPeopleNames(stepActors[nextIdx], people, users) : [];
  const stepMs = ticket.metrics?.stepMs instanceof Map ? Object.fromEntries(ticket.metrics.stepMs) : ticket.metrics?.stepMs || {};

  const view = {
    _id: idOf(ticket._id),
    number: ticket.number,
    code: codeOf(ticket.number),
    title: ticket.title,
    description: ticket.description || '',
    priority: ticket.priority,
    dueAt: ticket.dueAt,
    clientName: ticket.clientName || '',
    client: ticket.client ? idOf(ticket.client) : null,
    deliverable: ticket.deliverable?.month ? { month: ticket.deliverable.month, type: ticket.deliverable.type, index: ticket.deliverable.index } : null,
    carriedOver: Boolean(ticket.carriedOver),
    pipeline: ticket.pipeline,
    pipelineName: PIPELINE_NAME[ticket.pipeline],
    team: ticket.team ? { _id: idOf(ticket.team), title: ticket.teamName || chart.byId.get(idOf(ticket.team))?.title || '' } : null,
    raisedBy: { _id: idOf(ticket.raisedBy), name: userName(users.get(idOf(ticket.raisedBy))) },
    raisedFor: (() => {
      const e = people.get(idOf(ticket.raisedFor));
      return { _id: idOf(ticket.raisedFor), name: nameOf(e), designation: e?.designation || '' };
    })(),
    stage: ticket.stage,
    stageLabel: pipe.stepLabel(ticket, ticket.stage),
    color: pipe.colorFor(ticket, now),
    baseColor: pipe.baseColor(ticket),
    status: ticket.status,
    isSentBack: Boolean(ticket.isSentBack),
    isRejected: Boolean(ticket.isRejected),
    isOverdue: isOpen(ticket) && new Date(ticket.dueAt) < now,
    trail: pipe.trail(ticket).map((s, i) => ({ ...s, people: stepPeopleNames(stepActors[i], people, users), vacantFor: stepActors[i].fallback })),
    waitingOn: waiting,
    waitingOnLabel: isOpen(ticket) && steps[nextIdx] ? pipe.actorLabel(steps[nextIdx].actor, ticket) : null,
    nextStepLabel: isOpen(ticket) && steps[nextIdx] ? pipe.stepLabel(ticket, steps[nextIdx].key) : null,
    links: (ticket.links || []).map((l) => ({ _id: idOf(l._id), url: l.url, label: l.label || '', at: l.at, by: userName(users.get(idOf(l.addedBy))) })),
    completedAt: ticket.completedAt || null,
    rejectedAt: ticket.rejectedAt || null,
    submittedToCeoAt: ticket.submittedToCeoAt || null,
    ceoReviewedAt: ticket.ceoReviewedAt || null,
    ceoReviewedBy: ticket.ceoReviewedBy ? userName(users.get(idOf(ticket.ceoReviewedBy))) : null,
    ceoReviewNote: ticket.ceoReviewNote || '',
    metrics: { stepMs, reverts: ticket.metrics?.reverts || 0 },
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    assignments: ticket.assignments || {},
    smm: ticket.smm ? { _id: idOf(ticket.smm), name: nameOf(people.get(idOf(ticket.smm))) } : null,
    customSteps: (ticket.customSteps || []).map((s) => ({ key: s.key, label: s.label, color: s.color, assignee: idOf(s.assignee) })),
    isWork: wp.isWorkPipeline(ticket.pipeline),
    typeColor: wp.isWorkPipeline(ticket.pipeline) ? wp.PIPELINES[ticket.pipeline].typeColor : null,
    locked: Boolean(ticket.locked),
    parkedIn: parkedNow(ticket, now),
    lineupLabel: parkedNow(ticket, now) ? wp.LINEUPS[parkedNow(ticket, now)]?.label || null : null,
    parkNote: ticket.parkNote || '',
    scheduledFor: ticket.scheduledFor || null,
    approver: ticket.approver
      ? { _id: idOf(ticket.approver), name: nameOf(people.get(idOf(ticket.approver))) }
      : ticket.approverUser
        ? { _id: null, userId: idOf(ticket.approverUser), name: userName(users.get(idOf(ticket.approverUser))) }
        : null,
    people: Object.fromEntries(Object.entries(ticket.assignments || {}).filter(([, v]) => v).map(([k, v]) => [k, { _id: idOf(v), name: nameOf(people.get(idOf(v))) }])),
    next: (() => {
      const st = steps[nextIdx];
      if (!isOpen(ticket) || !st) return null;
      return { key: st.key, needsDate: Boolean(st.needsDate), needsLink: Boolean(st.needsLink), approval: Boolean(st.approval), viaShoot: Boolean(st.viaShoot) };
    })(),
    can: {
      start: isOpen(ticket) && Boolean(ticket.locked) && managesTicket(user, ticket, chart),
      pickUp:
        parkedNow(ticket, now) === 'editing' &&
        (managesTicket(user, ticket, chart) || (user.employeeLink && idOf(ticket.assignments?.editor) === idOf(user.employeeLink))),
      schedule: parkedNow(ticket, now) === 'calendar' && ctx.canAct,
      hold: isOpen(ticket) && !ticket.locked && parkedNow(ticket, now) !== 'hold' && managesTicket(user, ticket, chart),
      resume: parkedNow(ticket, now) === 'hold' && managesTicket(user, ticket, chart),
      reassign: isOpen(ticket) && (managesTicket(user, ticket, chart) || canEdit(user, ticket)),
      setDue: isOpen(ticket) && (managesTicket(user, ticket, chart) || canEdit(user, ticket)),
      act: ctx.canAct,
      sendBack: ctx.canAct && pipe.currentIndex(ticket) > 0,
      edit: canEdit(user, ticket),
      review: Boolean(ticket.submittedToCeoAt) && !ticket.ceoReviewedAt && seesEveryone(user),
      comment: true,
    },
    actingAs: ctx.canAct ? ctx.actingAs : null,
    repeat: null,
  };
  // Raised by a repeat: how it repeats, whether it still does, and who may stop it.
  if (ticket.repeat) {
    const rule = await TicketRepeat.findById(ticket.repeat).select('repeat active nextAt raisedCount raisedBy stoppedAt').lean();
    if (rule) {
      view.repeat = {
        _id: idOf(rule._id),
        repeat: rule.repeat,
        active: rule.active,
        nextAt: rule.active ? rule.nextAt : null,
        raisedCount: rule.raisedCount,
        stoppedAt: rule.stoppedAt || null,
        canStop: rule.active && (idOf(rule.raisedBy) === idOf(user.id) || seesEveryone(user)),
      };
    }
  }
  if (withRecord) {
    const events = await TicketEvent.find({ ticket: ticket._id }).sort({ at: 1, _id: 1 }).lean();
    view.record = events.map((e) => ({
      _id: idOf(e._id),
      type: e.type,
      at: e.at,
      byName: e.byName,
      actingAs: e.actingAs || null,
      onBehalfOf: e.onBehalfOf || null,
      fromStage: e.fromStage || null,
      toStage: e.toStage || null,
      fromLabel: e.fromLabel || null,
      toLabel: e.toLabel || null,
      fromColor: e.fromColor || null,
      toColor: e.toColor || null,
      note: e.note || '',
      changes: e.changes || [],
      meta: e.meta || null,
    }));
  }
  return view;
}

async function loadOr404(id) {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  return ticket;
}

async function loadViewable(user, id, chart) {
  const ticket = await loadOr404(id);
  if (!(await canView(user, ticket, chart))) throw ApiError.forbidden("You don't have access to this ticket");
  return ticket;
}

// Its code and title, if this person may see it — for planning it on the
// Weekly Calendar (ticketPlan.service.js).
async function canViewTicket(user, id) {
  const ticket = await loadViewable(user, id, await org.loadChart());
  return { code: codeOf(ticket.number), title: ticket.title };
}

// ---- reading --------------------------------------------------------------------

// Pipelines, colours, teams and who this person may raise tickets for.
async function meta(user) {
  const chart = await org.loadChart();
  const raisable = await org.raisableFor(user, chart);
  const people = await peopleMap([...raisable]);
  const teams = org.describeTeams(chart);
  const allHolderIds = teams.flatMap((t) => t.roles.flatMap((r) => r.holders));
  const holderNames = await peopleMap(allHolderIds);
  const below = [...raisable].filter((id) => id !== idOf(user.employeeLink));
  // The Team Lead, CEO and admin pick anyone, from any team, on a work ticket.
  const anyone = picksFromAnyTeam(user)
    ? (await Employee.find({ status: 'active', isDeleted: { $ne: true } }).select('firstName lastName designation').lean())
        .map((e) => ({ _id: idOf(e._id), name: nameOf(e), designation: e.designation || '', teams: org.teamsOfEmployee(chart, e._id).map((t) => idOf(t._id)) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : null;
  const me = idOf(user.employeeLink);
  return {
    ...pipe.catalogue(),
    everyone: anyone,
    // The CEO / admin logins with no employee record — they can still be a
    // General ticket's approver (as their login).
    approverLogins: (await User.find({ role: { $in: [USER_ROLES.CEO, USER_ROLES.ADMIN] }, isActive: { $ne: false }, employeeLink: null }).select('username role').lean()).map((u) => ({
      _id: idOf(u._id),
      name: userName(u),
      username: u.username,
    })),
    priorities: Object.values(TICKET_PRIORITY),
    raisable: [...people.values()]
      .map((e) => ({
        _id: idOf(e._id),
        name: nameOf(e),
        designation: e.designation || '',
        teams: org.teamsOfEmployee(chart, e._id).map((t) => idOf(t._id)),
        isSelf: idOf(e._id) === idOf(user.employeeLink),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    teams: teams.map((t) => {
      const person = (id) => ({ _id: id, name: nameOf(holderNames.get(id)) });
      return {
        ...t,
        roles: t.roles.map((r) => ({ ...r, holders: r.holders.map(person) })),
        // Each SMM with the Videographers and Editors in their own boxes.
        smms: t.smms.map((s) => ({ ...person(s.employeeId), videographers: s.videographers.map(person), editors: s.editors.map(person) })),
        heads: t.roles.filter((r) => r.isHead).flatMap((r) => r.holders).map(person),
      };
    }),
    me: {
      employeeId: idOf(user.employeeLink),
      postLabel: postLabel(user, chart),
      teams: user.employeeLink ? org.teamsOfEmployee(chart, user.employeeLink).map((t) => idOf(t._id)) : [],
      seesEveryone: seesEveryone(user),
      isCeo: isCeo(user),
      isAdmin: isAdmin(user),
      hasTeam: below.length > 0,
      isTeamLead: isTeamLead(user),
      picksFromAnyTeam: picksFromAnyTeam(user),
      // The teams this person is the Content Manager of (they start, hold and plan its work).
      cmOf: me ? teams.filter((t) => org.roleHolders(chart, t._id, org.TEAM_ROLE.CONTENT_MANAGER).includes(me)).map((t) => t._id) : [],
    },
  };
}

// scope: 'mine' (waiting on me), 'raised' (I raised), 'team' (anyone below
// me), 'all' (CEO/admin), 'submitted' (the CEO's section).
async function list(user, { scope = 'mine', status = 'open', q, lineup } = {}) {
  const chart = await org.loadChart();
  const filter = {};
  // Locked tickets to start, or tickets waiting in a lineup — for the people
  // who manage them, and (lineups) the people they wait on.
  if (scope === 'to_start' || scope === 'lineup') {
    const f = { status: TICKET_STATUS.OPEN };
    if (scope === 'to_start') f.locked = true;
    else {
      f.locked = { $ne: true };
      f.parkedIn = lineup && wp.LINEUPS[lineup] ? lineup : { $ne: null };
    }
    const found = await Ticket.find(f).sort({ dueAt: 1 }).limit(500);
    const out = [];
    for (const t of found) {
      /* eslint-disable no-await-in-loop */
      if (scope === 'lineup' && !parkedNow(t)) continue;
      const mine = managesTicket(user, t, chart) || (scope === 'lineup' && (await involvedEmployees(t, chart)).has(idOf(user.employeeLink)));
      if (mine) out.push(await toView(user, t, chart));
      /* eslint-enable no-await-in-loop */
    }
    return out;
  }
  if (scope === 'submitted') {
    if (!seesEveryone(user)) throw ApiError.forbidden('Only the CEO and admin see submitted tickets');
    filter.submittedToCeoAt = { $ne: null };
    if (status === 'unreviewed') filter.ceoReviewedAt = null;
    else if (status === 'reviewed') filter.ceoReviewedAt = { $ne: null };
    else if (status === 'rejected') filter.status = TICKET_STATUS.REJECTED;
    else if (status === 'completed') filter.status = TICKET_STATUS.COMPLETED;
  } else if (status && status !== 'all') {
    filter.status = status;
  }
  if (scope === 'raised') filter.raisedBy = user.id;
  if (scope === 'all' && !seesEveryone(user)) throw ApiError.forbidden('Only the CEO and admin see every ticket');
  if (scope === 'mine') filter.status = TICKET_STATUS.OPEN;
  if (q?.trim()) {
    const term = q.trim();
    const num = Number(term.replace(/^tkt-?/i, ''));
    filter.$or = [{ title: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, ...(Number.isFinite(num) && num > 0 ? [{ number: num }] : [])];
  }

  const tickets = await Ticket.find(filter).sort(scope === 'submitted' ? { submittedToCeoAt: -1 } : { dueAt: 1 }).limit(500);
  const raisable = await org.raisableFor(user, chart);
  const keep = [];
  for (const t of tickets) {
    /* eslint-disable no-await-in-loop */
    if (scope === 'mine') {
      // Tickets waiting in a lineup are in the lineup lists, not on the board.
      const ctx = await actingContext(user, t, chart);
      if (ctx.canAct && ctx.natural && !parkedNow(t)) keep.push(t);
    } else if (scope === 'team') {
      if (seesEveryone(user)) keep.push(t);
      else {
        const involved = await involvedEmployees(t, chart);
        if ([...involved].some((id) => raisable.has(id) && id !== idOf(user.employeeLink))) keep.push(t);
      }
    } else if (scope === 'raised' || scope === 'all' || scope === 'submitted') {
      keep.push(t);
    }
    /* eslint-enable no-await-in-loop */
  }
  const views = [];
  for (const t of keep) {
    // eslint-disable-next-line no-await-in-loop
    views.push(await toView(user, t, chart));
  }
  return views;
}

async function get(user, id) {
  const chart = await org.loadChart();
  const ticket = await loadViewable(user, id, chart);
  // The first time each person opens it is part of the record.
  const seen = await TicketEvent.exists({ ticket: ticket._id, type: EV.SEEN, byUser: user.id });
  if (!seen) await record(ticket, EV.SEEN, user, { actingAs: postLabel(user, chart) });
  return toView(user, ticket, chart, { withRecord: true });
}

// For the dashboard card: how many wait on me, plus the first few.
async function summary(user) {
  const waiting = await list(user, { scope: 'mine' });
  const raised = await Ticket.countDocuments({ raisedBy: user.id, status: TICKET_STATUS.OPEN });
  const unreviewed = seesEveryone(user) ? await Ticket.countDocuments({ submittedToCeoAt: { $ne: null }, ceoReviewedAt: null }) : 0;
  const startable = await list(user, { scope: 'to_start' });
  return {
    toStart: startable.length,
    waitingCount: waiting.length,
    overdueCount: waiting.filter((t) => t.isOverdue).length,
    raisedOpen: raised,
    unreviewed,
    waiting: waiting.slice(0, 5),
  };
}

// ---- raising ---------------------------------------------------------------------

function cleanAssignments(pipeline, a = {}) {
  if (pipeline === P.POST) return { designer: a.designer };
  if (pipeline === P.REEL) return { shooter: a.shooter, editor: a.editor, contentManager: a.contentManager };
  return {};
}

// `repeatId`: raised by a repeat (ticketRepeat.service.js) — the copy is
// tied to it and its record says so. `system`: made from a client's month
// (clientWork.service.js) — the people come from the client's team, so the
// "your own box or below" rule doesn't apply; `quiet` skips the per-ticket
// notifications (one summary goes instead); `extra` links it to the client
// and the month; `bare` returns the document rather than the screen's view.
async function raise(user, input, { repeatId = null, repeatLabel = null, system = false, quiet = false, extra = null, bare = false, chart: givenChart = null, locked = false } = {}) {
  const chart = givenChart || (await org.loadChart());
  const raisable = system ? null : await org.raisableFor(user, chart);
  const { pipeline } = input;
  const mayRaiseFor = (id) => system || raisable.has(idOf(id));
  const deny = () => ApiError.forbidden('You can only raise tickets for people in your own box or below it in the Organisation chart');

  let raisedFor = input.raisedFor;
  let assignments = {};
  let customSteps = [];
  let team = null;
  let smm = null;
  // People on steps above the person it's raised for (the SMM checking a
  // reel, the team's Content Manager) — chosen, not raised for.
  const approvers = [];

  const work = wp.isWorkPipeline(pipeline);
  let approver = null;
  let approverUser = null;
  // The older tables only show tickets already made on them (and repeats).
  if (!work && pipeline !== P.CUSTOM && !repeatId && !system) throw ApiError.badRequest('Raise it as General, Reel, Post or Story');
  if (work && pipeline !== P.GENERAL) {
    team = chart.byId.get(idOf(input.team));
    if (!team || team.kind !== ORG_NODE_KIND.TEAM) throw ApiError.badRequest('Choose the team this ticket is for');
    const free = system || picksFromAnyTeam(user);
    const a = input.assignments || {};
    const teamSmms = org.roleHolders(chart, team._id, org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER);
    smm = a.smm || input.smm || teamSmms[0];
    if (!smm) throw ApiError.badRequest(`${team.title} has no Social Media Manager — choose one`);
    if (!free && teamSmms.length && !teamSmms.includes(idOf(smm))) throw ApiError.badRequest(`That person is not a Social Media Manager in ${team.title}`);
    const cms = org.roleHolders(chart, team._id, org.TEAM_ROLE.CONTENT_MANAGER);
    const contentManager = a.contentManager || cms[0] || org.teamHeads(chart, team._id)[0] || null;
    if (pipeline === P.STORY2) {
      if (!contentManager) throw ApiError.badRequest(`${team.title} has no Content Manager — choose one`);
      assignments = { smm, contentManager };
      raisedFor = smm;
    } else if (pipeline === P.POST2) {
      // The team's Graphic Designer; the Social Media Manager when there's none.
      const designer = a.designer || org.roleHolders(chart, team._id, org.TEAM_ROLE.GRAPHIC_DESIGNER)[0] || smm;
      assignments = { designer, smm, contentManager };
      raisedFor = designer;
    } else if (pipeline === P.REEL2) {
      if (!a.shooter || !a.editor) throw ApiError.badRequest('A reel needs its videographer and video editor');
      if (!contentManager) throw ApiError.badRequest(`${team.title} has no Content Manager — choose one`);
      assignments = { shooter: a.shooter, editor: a.editor, contentManager, smm };
      raisedFor = contentManager;
    }
  } else if (pipeline === P.GENERAL) {
    raisedFor = input.raisedFor;
    // Whoever is chosen, else whoever raises it — kept on the ticket so it
    // shows, and can be changed. (A login without an employee record still
    // approves its own as the raiser.)
    approver = input.approver || (input.approverUser ? null : user.employeeLink) || null;
    approverUser = !input.approver && input.approverUser ? input.approverUser : null;
  }
  if ([P.STORY, P.POST, P.REEL].includes(pipeline)) {
    team = chart.byId.get(idOf(input.team));
    if (!team || team.kind !== ORG_NODE_KIND.TEAM) throw ApiError.badRequest('Choose the team this ticket is for');
    smm = input.smm || (pipeline === P.POST ? input.assignments?.designer : null) || (pipeline === P.STORY ? input.raisedFor : null);
    if (!smm) throw ApiError.badRequest("Choose the team's Social Media Manager it is for");
    const teamSmms = org.roleHolders(chart, team._id, org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER);
    if (teamSmms.length && !teamSmms.includes(idOf(smm))) {
      throw ApiError.badRequest(`That person is not a Social Media Manager in ${team.title}`);
    }
  }
  if (pipeline === P.STORY) {
    raisedFor = smm;
  } else if (pipeline === P.POST) {
    assignments = { designer: smm };
    raisedFor = smm;
  } else if (pipeline === P.REEL) {
    assignments = cleanAssignments(pipeline, input.assignments);
    const heads = org.teamHeads(chart, team._id);
    if (!assignments.contentManager) assignments.contentManager = heads[0];
    if (heads.length && !heads.includes(idOf(assignments.contentManager))) {
      throw ApiError.badRequest(`The content manager has to be ${team.title}'s Content Manager`);
    }
    if (!assignments.shooter || !assignments.editor || !assignments.contentManager) {
      throw ApiError.badRequest('A reel needs its videographer, editor and content manager');
    }
    raisedFor = assignments.shooter;
    approvers.push(smm, assignments.contentManager);
  } else if (pipeline === P.CUSTOM) {
    const steps = input.customSteps || [];
    if (steps.length < 2 || steps.length > 5) throw ApiError.badRequest('A custom pipeline has 2 to 5 steps');
    const palette = new Set(pipe.catalogue().customPalette);
    customSteps = steps.map((s, i) => {
      if (!s.label?.trim()) throw ApiError.badRequest(`Step ${i + 1} needs a name`);
      if (!palette.has(s.color)) throw ApiError.badRequest(`Step ${i + 1} needs one of the pipeline colours`);
      if (!s.assignee) throw ApiError.badRequest(`Step ${i + 1} needs a person`);
      return { key: `step_${i + 1}`, label: s.label.trim(), color: s.color, assignee: s.assignee };
    });
    raisedFor = customSteps[0].assignee;
  }
  if (!raisedFor) throw ApiError.badRequest('Choose who this ticket is for');

  const approverIds = new Set(approvers.filter(Boolean).map(idOf));
  const people = [raisedFor, ...Object.values(assignments), ...customSteps.map((s) => s.assignee)]
    .filter(Boolean)
    .filter((p) => !approverIds.has(idOf(p)) || idOf(p) === idOf(raisedFor));
  if (!(work && picksFromAnyTeam(user)) && !people.every(mayRaiseFor)) throw deny();

  const number = await counterRepository.nextSequence('ticket');
  const now = new Date();
  const ticket = await Ticket.create({
    number,
    title: input.title.trim(),
    description: input.description?.trim() || '',
    priority: input.priority || TICKET_PRIORITY.NORMAL,
    dueAt: input.dueAt,
    clientName: input.clientName?.trim() || '',
    pipeline,
    team: team ? team._id : null,
    teamName: team ? team.title : '',
    smm: smm || null,
    assignments,
    customSteps,
    raisedBy: user.id,
    raisedByEmployee: user.employeeLink || null,
    raisedFor,
    approver,
    approverUser,
    locked: Boolean(locked),
    repeat: repeatId,
    ...(extra || {}),
    stage: 'created',
    metrics: { stepMs: {}, reverts: 0, lastMovedAt: now },
  });

  const names = await peopleMap([...people, smm, ...approvers]);
  await record(ticket, EV.RAISED, user, {
    actingAs: postLabel(user, chart),
    toStage: 'created',
    toLabel: pipe.stepLabel(ticket, 'created'),
    toColor: pipe.colorFor(ticket, now),
    note: ticket.description || '',
    meta: {
      code: codeOf(number),
      title: ticket.title,
      pipeline: PIPELINE_NAME[pipeline],
      priority: ticket.priority,
      dueAt: ticket.dueAt,
      clientName: ticket.clientName || null,
      team: ticket.teamName || null,
      raisedFor: nameOf(names.get(idOf(raisedFor))),
      smm: smm ? nameOf(names.get(idOf(smm))) : null,
      steps: pipe.trail(ticket).map((s) => ({ label: s.label, color: s.color, by: s.actorLabel })),
      people: Object.fromEntries(Object.entries(assignments).map(([k, v]) => [k, nameOf(names.get(idOf(v)))])),
      customSteps: customSteps.map((s) => ({ label: s.label, color: s.color, person: nameOf(names.get(idOf(s.assignee))) })),
      ...(repeatLabel ? { repeat: repeatLabel } : {}),
      ...(extra?.deliverable ? { deliverable: { month: extra.deliverable.month, type: extra.deliverable.type, index: extra.deliverable.index } } : {}),
    },
  });

  if (quiet || locked) return bare ? ticket : toView(user, ticket, chart);
  const raiser = (await userMap([user.id])).get(idOf(user.id));
  await notify([], [raisedFor], {
    type: NT.TICKET_RAISED,
    title: `New ticket ${codeOf(number)} — ${ticket.title}`,
    message: `${userName(raiser) || 'Someone'} raised "${ticket.title}" for you, due ${new Date(ticket.dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    ticket,
  }, user.id);
  // The first step's people, when it isn't the person it was raised for.
  await notifyWaiting(ticket, chart, user.id, NT.TICKET_YOUR_STEP, `Ticket ${codeOf(number)} is waiting on you`, `"${ticket.title}" — ${pipe.stepLabel(ticket, pipe.nextStep(ticket)?.key)} is your step.`).catch(() => {});

  return bare ? ticket : toView(user, ticket, chart);
}

// ---- moving through the pipeline ---------------------------------------------

// Adds the time spent at the step it's leaving.
function metricsUpdate(ticket, now) {
  const since = ticket.metrics?.lastMovedAt || ticket.createdAt;
  const ms = Math.max(0, now - new Date(since));
  return { $inc: { [`metrics.stepMs.${ticket.stage}`]: ms }, $set: { 'metrics.lastMovedAt': now } };
}

// Applies a move only if nobody else moved the ticket meanwhile.
async function applyMove(ticket, set, inc = {}) {
  const now = new Date();
  const m = metricsUpdate(ticket, now);
  const res = await Ticket.updateOne(
    { _id: ticket._id, stage: ticket.stage, status: TICKET_STATUS.OPEN, isRejected: false },
    { $set: { ...set, ...m.$set }, $inc: { ...m.$inc, ...inc } }
  );
  if (!res.modifiedCount) throw ApiError.conflict('This ticket has just moved — refresh and try again');
  return Ticket.findById(ticket._id);
}

async function finishIfTerminal(user, ticket, chart) {
  if (!pipe.isTerminal(ticket)) return ticket;
  const now = new Date();
  await Ticket.updateOne({ _id: ticket._id }, { $set: { status: TICKET_STATUS.COMPLETED, completedAt: now, submittedToCeoAt: now } });
  const done = await Ticket.findById(ticket._id);
  const onTime = now <= new Date(done.dueAt);
  await record(done, EV.COMPLETED, user, {
    actingAs: postLabel(user, chart),
    toStage: done.stage,
    toLabel: pipe.stepLabel(done, done.stage),
    toColor: pipe.colorFor(done, now),
    meta: { onTime, totalMs: now - new Date(done.createdAt), reverts: done.metrics?.reverts || 0 },
  });
  await record(done, EV.SUBMITTED_TO_CEO, null, { note: 'Submitted to the CEO automatically on completion', toColor: pipe.colorFor(done, now) });
  await notify([done.raisedBy], [done.raisedFor], {
    type: NT.TICKET_COMPLETED,
    title: `Ticket ${codeOf(done.number)} is complete`,
    message: `"${done.title}" reached its last step${onTime ? ' on time' : ' after its due date'}.`,
    ticket: done,
  }, user.id);
  const ceo = await org.ceoAndAdmin(chart, { includeAdmin: false });
  await notify(ceo.userIds, ceo.employeeIds, {
    type: NT.TICKET_SUBMITTED,
    title: `Ticket ${codeOf(done.number)} submitted to you`,
    message: `"${done.title}" is complete and waiting for your review.`,
    ticket: done,
  });
  return done;
}

// What reaching a step sets: a work pipeline's ticket goes into the lineup
// after its phase, or waits for its posting date once scheduled.
function arrival(ticket, step, { when = null } = {}) {
  if (!wp.isWorkPipeline(ticket.pipeline)) return {};
  if (step.needsDate) {
    const later = when && when > new Date();
    return { scheduledFor: when, parkedIn: later ? 'posting' : null, parkedUntil: later ? when : null };
  }
  return { parkedIn: step.lineupAfter || null, parkedUntil: null };
}

async function noteParked(moved, user) {
  if (!moved.parkedIn) return;
  const lineup = wp.LINEUPS[moved.parkedIn];
  await record(moved, EV.PARKED, user, {
    toStage: moved.stage,
    toLabel: pipe.stepLabel(moved, moved.stage),
    note: moved.parkedIn === 'posting' ? `Scheduled for ${new Date(moved.parkedUntil).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}` : `In the ${lineup?.label.toLowerCase() || 'lineup'} — waits ${lineup?.leaves || ''}`,
    meta: { lineup: moved.parkedIn, until: moved.parkedUntil || null },
  });
}

// `viaShoot`: the shoot service completing a shoot step. `hours`: what the
// person confirmed for their step (ticketHours.service.js).
async function advance(user, id, { note, date, link, minutes, reason } = {}, { viaShoot = false } = {}) {
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  const ctx = await actingContext(user, ticket, chart);
  if (!ctx.canAct) throw ApiError.forbidden("This step isn't yours to complete");
  const step = ctx.step;
  const when = date ? new Date(date) : null;
  if (step.viaShoot && !viaShoot) throw ApiError.badRequest('This step is done through the shoot — plan it, or mark it shot, in Shoots');
  if (step.needsDate && (!when || Number.isNaN(when.getTime()))) throw ApiError.badRequest('Choose the posting date');
  if (step.needsLink && !/^https?:\/\//i.test(String(link || '').trim())) throw ApiError.badRequest('Paste the link (it starts with https://)');

  const now = new Date();
  const restart = Boolean(ticket.isSentBack);
  const fromColor = pipe.colorFor(ticket, now);
  const hours = require('./ticketHours.service');
  const held = await hours.beforeMove(user, ticket, step, ctx, chart, { minutes, reason });
  let moved = await applyMove(ticket, { stage: step.key, isSentBack: false, ...arrival(ticket, step, { when }) });
  if (step.needsLink) {
    await Ticket.updateOne({ _id: moved._id }, { $push: { links: { url: String(link).trim(), label: pipe.stepLabel(moved, step.key), addedBy: user.id, at: now } } });
    moved = await Ticket.findById(moved._id);
  }
  await record(moved, restart ? EV.RESTARTED : EV.ADVANCED, user, {
    actingAs: ctx.actingAs,
    onBehalfOf: ctx.onBehalfOf,
    fromStage: ticket.stage,
    toStage: moved.stage,
    fromLabel: pipe.stepLabel(ticket, ticket.stage),
    toLabel: pipe.stepLabel(moved, moved.stage),
    fromColor,
    toColor: pipe.colorFor(moved, now),
    note: note?.trim() || '',
    ...(step.needsLink || step.needsDate ? { meta: { ...(step.needsLink ? { link: String(link).trim() } : {}), ...(step.needsDate ? { date: when } : {}) } } : {}),
  });
  await hours.afterMove(user, moved, step, held);
  await noteParked(moved, user);

  // Same-person auto-skip, as on the calendar: a Team Lead (or the CEO, on a
  // work pipeline) completing a step isn't asked to approve their own work
  // at the approval step right after.
  const following = pipe.nextStep(moved);
  if (following && !pipe.isTerminal(moved) && !moved.parkedIn && ['global_team_lead', 'smm_or_lead', 'tl_ceo'].includes(following.actor?.type)) {
    const leads = await org.teamLeads(chart);
    const ceo = following.actor.type === 'tl_ceo' ? await org.ceoAndAdmin(chart, { includeAdmin: false }) : { employeeIds: [], userIds: [] };
    if (isIn(user, { employeeIds: [...leads.employeeIds, ...ceo.employeeIds], userIds: [...leads.userIds, ...ceo.userIds] })) {
      const before = moved;
      moved = await applyMove(moved, { stage: following.key, ...arrival(moved, following) });
      await record(moved, EV.ADVANCED, user, {
        actingAs: 'Team Lead',
        fromStage: before.stage,
        toStage: moved.stage,
        fromLabel: pipe.stepLabel(before, before.stage),
        toLabel: pipe.stepLabel(moved, moved.stage),
        fromColor: pipe.colorFor(before, now),
        toColor: pipe.colorFor(moved, now),
        note: 'Skipped automatically — the same person is the Team Lead',
      });
      await noteParked(moved, user);
    }
  }

  if (pipe.isTerminal(moved)) {
    moved = await finishIfTerminal(user, moved, chart);
  } else if (!parkedNow(moved)) {
    await notifyWaiting(moved, chart, user.id, NT.TICKET_YOUR_STEP, `Ticket ${codeOf(moved.number)} is waiting on you`, `"${moved.title}" moved to "${pipe.stepLabel(moved, moved.stage)}" — the next step is yours.`);
  }
  return toView(user, moved, chart);
}

async function sendBack(user, id, { note }) {
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  const ctx = await actingContext(user, ticket, chart);
  if (!ctx.canAct) throw ApiError.forbidden("You can't send this ticket back");
  const idx = pipe.currentIndex(ticket);
  if (idx === 0) throw ApiError.badRequest('This ticket is already at its first step');
  if (!note?.trim()) throw ApiError.badRequest('Say why it is being sent back');

  const now = new Date();
  const steps = pipe.stepsFor(ticket);
  const fromColor = pipe.colorFor(ticket, now);
  let target = idx - 1;
  if (wp.isWorkPipeline(ticket.pipeline)) {
    // Changes asked at an approval go back to the last piece of work, not to
    // the approval before it.
    let w = idx;
    while (w > 0 && (steps[w].approval || steps[w].viaShoot)) w -= 1;
    target = Math.max(0, w - 1);
  }
  const moved = await applyMove(ticket, { stage: steps[target].key, isSentBack: true, parkedIn: null, parkedUntil: null }, { 'metrics.reverts': 1 });
  await record(moved, EV.SENT_BACK, user, {
    actingAs: ctx.actingAs,
    onBehalfOf: ctx.onBehalfOf,
    fromStage: ticket.stage,
    toStage: moved.stage,
    fromLabel: pipe.stepLabel(ticket, ticket.stage),
    toLabel: pipe.stepLabel(moved, moved.stage),
    fromColor,
    toColor: pipe.colorFor(moved, now),
    note: note.trim(),
  });
  await notifyWaiting(moved, chart, user.id, NT.TICKET_SENT_BACK, `Ticket ${codeOf(moved.number)} was sent back to you`, `"${moved.title}" needs "${pipe.stepLabel(moved, pipe.nextStep(moved)?.key)}" redone: ${note.trim()}`);
  return toView(user, moved, chart);
}

async function reject(user, id, { reason }) {
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  const ctx = await actingContext(user, ticket, chart);
  if (!ctx.canAct) throw ApiError.forbidden("You can't reject this ticket");
  if (!reason?.trim()) throw ApiError.badRequest('A reason is required to reject a ticket');

  const now = new Date();
  const fromColor = pipe.colorFor(ticket, now);
  const res = await Ticket.updateOne(
    { _id: ticket._id, stage: ticket.stage, status: TICKET_STATUS.OPEN },
    {
      $set: { isRejected: true, status: TICKET_STATUS.REJECTED, rejectedAt: now, submittedToCeoAt: now, 'metrics.lastMovedAt': now },
      $inc: { [`metrics.stepMs.${ticket.stage}`]: Math.max(0, now - new Date(ticket.metrics?.lastMovedAt || ticket.createdAt)) },
    }
  );
  if (!res.modifiedCount) throw ApiError.conflict('This ticket has just moved — refresh and try again');
  const done = await Ticket.findById(ticket._id);
  await record(done, EV.REJECTED, user, {
    actingAs: ctx.actingAs,
    onBehalfOf: ctx.onBehalfOf,
    fromStage: ticket.stage,
    toStage: done.stage,
    fromLabel: pipe.stepLabel(ticket, ticket.stage),
    toLabel: pipe.stepLabel(done, done.stage),
    fromColor,
    toColor: pipe.colorFor(done, now),
    note: reason.trim(),
  });
  await record(done, EV.SUBMITTED_TO_CEO, null, { note: 'Submitted to the CEO automatically on rejection', toColor: pipe.colorFor(done, now) });
  const involved = await involvedEmployees(done, chart);
  await notify([done.raisedBy], [...involved], {
    type: NT.TICKET_REJECTED,
    title: `Ticket ${codeOf(done.number)} was rejected`,
    message: `"${done.title}": ${reason.trim()}`,
    ticket: done,
  }, user.id);
  return toView(user, done, chart);
}


// ---- locked tickets, lineups, hold (work pipelines) --------------------------------

function checkDue(dueAt) {
  const due = dueAt ? new Date(dueAt) : null;
  if (!due || Number.isNaN(due.getTime())) throw ApiError.badRequest('Set the due date');
  return due;
}

// Start work on a locked ticket: its first step opens and its due date is set.
async function start(user, id, { dueAt, note } = {}, { chart: givenChart = null, quiet = false } = {}) {
  const chart = givenChart || (await org.loadChart());
  const ticket = await loadOr404(id);
  if (!ticket.locked) throw ApiError.conflict('This ticket has already been started');
  if (!isOpen(ticket)) throw ApiError.conflict('This ticket is closed');
  if (!managesTicket(user, ticket, chart)) throw ApiError.forbidden('Only the team’s Content Manager, the Team Lead, the CEO or admin start work on it');
  const due = checkDue(dueAt);
  const now = new Date();
  await Ticket.updateOne({ _id: ticket._id, locked: true }, { $set: { locked: false, dueAt: due, overdueAt: null, 'metrics.lastMovedAt': now } });
  const started = await Ticket.findById(ticket._id);
  await record(started, EV.STARTED, user, {
    actingAs: postLabel(user, chart),
    toStage: started.stage,
    toLabel: pipe.stepLabel(started, started.stage),
    toColor: pipe.colorFor(started, now),
    note: note?.trim() || '',
    changes: [{ field: 'Due', from: null, to: due }],
  });
  if (!quiet) {
    await notifyWaiting(started, chart, user.id, NT.TICKET_YOUR_STEP, `Ticket ${codeOf(started.number)} has started`, `"${started.title}" — ${pipe.stepLabel(started, pipe.nextStep(started)?.key)} is your step, due ${due.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`).catch(() => {});
  }
  return toView(user, started, chart);
}

// Several at once — each with its own due date, or one for all.
async function startMany(user, { items = [], ids = [], dueAt } = {}) {
  const chart = await org.loadChart();
  const list = items.length ? items : ids.map((x) => ({ id: x, dueAt }));
  if (!list.length) throw ApiError.badRequest('Choose the tickets to start');
  if (list.length > 100) throw ApiError.badRequest('At most 100 at a time');
  const out = [];
  for (const it of list) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await start(user, it.id, { dueAt: it.dueAt }, { chart }));
  }
  return out;
}

async function setParked(user, ticket, chart, parkedIn, { note, until = null } = {}) {
  const now = new Date();
  const was = parkedNow(ticket, now);
  await Ticket.updateOne({ _id: ticket._id }, { $set: { parkedIn, parkedUntil: until, parkNote: note?.trim() || '', 'metrics.lastMovedAt': now } });
  const moved = await Ticket.findById(ticket._id);
  if (parkedIn) {
    await record(moved, EV.PARKED, user, { actingAs: postLabel(user, chart), toStage: moved.stage, note: note?.trim() || wp.LINEUPS[parkedIn]?.label || '', meta: { lineup: parkedIn, until } });
  } else {
    await record(moved, EV.UNPARKED, user, { actingAs: user ? postLabel(user, chart) : null, toStage: moved.stage, note: note?.trim() || `Out of the ${(wp.LINEUPS[was]?.label || 'lineup').toLowerCase()}` });
  }
  return moved;
}

// The editor takes a shot reel out of the editing lineup — its time counts from now.
async function pickUp(user, id) {
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  if (parkedNow(ticket) !== 'editing') throw ApiError.conflict('This ticket isn’t waiting in the editing lineup');
  const isEditor = user.employeeLink && idOf(ticket.assignments?.editor) === idOf(user.employeeLink);
  if (!isEditor && !managesTicket(user, ticket, chart)) throw ApiError.forbidden('Only its editor (or the Content Manager, Team Lead, CEO or admin) starts editing it');
  const moved = await setParked(user, ticket, chart, null, { note: 'Editing started' });
  return toView(user, moved, chart);
}

async function hold(user, id, { reason }) {
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  if (!isOpen(ticket) || ticket.locked) throw ApiError.conflict('Only a started, open ticket can be put on hold');
  if (!managesTicket(user, ticket, chart)) throw ApiError.forbidden('Only the team’s Content Manager, the Team Lead, the CEO or admin put a ticket on hold');
  if (!reason?.trim()) throw ApiError.badRequest('Say why it is on hold');
  const moved = await setParked(user, ticket, chart, 'hold', { note: `On hold: ${reason.trim()}` });
  return toView(user, moved, chart);
}

async function resume(user, id, { note } = {}) {
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  if (parkedNow(ticket) !== 'hold') throw ApiError.conflict('This ticket isn’t on hold');
  if (!managesTicket(user, ticket, chart)) throw ApiError.forbidden('Only the team’s Content Manager, the Team Lead, the CEO or admin resume it');
  const moved = await setParked(user, ticket, chart, null, { note: note?.trim() || 'Resumed' });
  await notifyWaiting(moved, chart, user.id, NT.TICKET_YOUR_STEP, `Ticket ${codeOf(moved.number)} is back on`, `"${moved.title}" is off hold — ${pipe.stepLabel(moved, pipe.nextStep(moved)?.key)} is your step.`).catch(() => {});
  return toView(user, moved, chart);
}

// Daily: a scheduled ticket whose posting date has come is the Social Media
// Manager's to upload — written to its record.
async function releaseScheduled(now = new Date()) {
  const due = await Ticket.find({ parkedIn: { $ne: null }, parkedUntil: { $lte: now }, status: TICKET_STATUS.OPEN });
  const chart = due.length ? await org.loadChart() : null;
  for (const t of due) {
    const posting = t.parkedIn === 'posting';
    // eslint-disable-next-line no-await-in-loop
    const moved = await setParked(null, t, chart, null, { note: posting ? 'Posting date — ready to upload' : 'Shoot day' });
    // eslint-disable-next-line no-await-in-loop
    await notifyWaiting(
      moved,
      chart,
      null,
      NT.TICKET_YOUR_STEP,
      posting ? `Upload today: ${codeOf(moved.number)}` : `Shoot today: ${codeOf(moved.number)}`,
      posting ? `"${moved.title}" is scheduled for today — upload it and add the link.` : `"${moved.title}" is on today's shoot.`
    ).catch(() => {});
  }
  return due.length;
}

// A shoot moving its reels (shootSession.service.js checks who may):
// planned (out of the shoot lineup, waiting for the day), shot, or back to
// the lineup. Not a step anyone completes on the ticket itself.
async function moveByShoot(user, ticket, { toStage, parkedIn = null, parkedUntil = null, note, meta } = {}) {
  const chart = await org.loadChart();
  const now = new Date();
  const fromColor = pipe.colorFor(ticket, now);
  const back = pipe.stepsFor(ticket).findIndex((s) => s.key === toStage) < pipe.currentIndex(ticket);
  const res = await Ticket.updateOne(
    { _id: ticket._id, stage: ticket.stage, status: TICKET_STATUS.OPEN },
    { $set: { stage: toStage, isSentBack: false, parkedIn, parkedUntil, 'metrics.lastMovedAt': now }, $inc: { [`metrics.stepMs.${ticket.stage}`]: Math.max(0, now - new Date(ticket.metrics?.lastMovedAt || ticket.createdAt)) } }
  );
  if (!res.modifiedCount) throw ApiError.conflict(`${ticket.title} has just moved — refresh and try again`);
  const moved = await Ticket.findById(ticket._id);
  await record(moved, back ? EV.SENT_BACK : EV.ADVANCED, user, {
    actingAs: postLabel(user, chart),
    fromStage: ticket.stage,
    toStage,
    fromLabel: pipe.stepLabel(ticket, ticket.stage),
    toLabel: pipe.stepLabel(moved, toStage),
    fromColor,
    toColor: pipe.colorFor(moved, now),
    note: note || '',
    meta,
  });
  await noteParked(moved, user);
  return moved;
}

// ---- edits, reassigning, comments, links -------------------------------------

const FIELD_LABEL = { title: 'Title', description: 'Description', priority: 'Priority', clientName: 'Client', dueAt: 'Due' };

async function edit(user, id, input) {
  const chart = await org.loadChart();
  const ticket = await loadViewable(user, id, chart);
  if (!canEdit(user, ticket) && !(isOpen(ticket) && managesTicket(user, ticket, chart))) {
    throw ApiError.forbidden('Only whoever raised it, the team’s Content Manager, the Team Lead, the CEO or admin can change an open ticket');
  }

  const changes = [];
  const set = {};
  for (const field of ['title', 'description', 'priority', 'clientName']) {
    if (input[field] === undefined) continue;
    const next = typeof input[field] === 'string' ? input[field].trim() : input[field];
    if ((ticket[field] || '') !== (next || '')) {
      changes.push({ field: FIELD_LABEL[field], from: ticket[field] || '', to: next || '' });
      set[field] = next;
    }
  }
  let dueChange = null;
  if (input.dueAt !== undefined && new Date(input.dueAt).getTime() !== new Date(ticket.dueAt).getTime()) {
    dueChange = { field: 'Due', from: ticket.dueAt, to: new Date(input.dueAt) };
    set.dueAt = new Date(input.dueAt);
    // A new due date starts the overdue clock again.
    if (new Date(input.dueAt) > new Date()) set.overdueAt = null;
  }
  if (!changes.length && !dueChange) return toView(user, ticket, chart);

  await Ticket.updateOne({ _id: ticket._id }, { $set: set });
  const updated = await Ticket.findById(ticket._id);
  const actingAs = postLabel(user, chart);
  if (changes.length) await record(updated, EV.EDITED, user, { actingAs, changes, note: input.note?.trim() || '' });
  if (dueChange) await record(updated, EV.DUE_CHANGED, user, { actingAs, changes: [dueChange], note: input.note?.trim() || '' });
  return toView(user, updated, chart);
}

// Changing who does a step that hasn't been reached yet.
async function reassign(user, id, { field, stepKey, employeeId, note }) {
  const chart = await org.loadChart();
  const ticket = await loadViewable(user, id, chart);
  if (wp.isWorkPipeline(ticket.pipeline)) return reassignWork(user, ticket, chart, { field, employeeId, note });
  if (!canEdit(user, ticket)) throw ApiError.forbidden('Only whoever raised it, the CEO or admin can reassign it');
  if (!(await org.canRaiseFor(user, employeeId, chart))) {
    throw ApiError.forbidden('You can only hand a ticket to people in your own box or below');
  }

  const steps = pipe.stepsFor(ticket);
  const reachedIdx = pipe.currentIndex(ticket);
  const stepIndex = (pred) => steps.findIndex(pred);
  let set = {};
  let from = null;
  let label = '';
  if (ticket.pipeline === P.SIMPLE) {
    if (reachedIdx >= 1) throw ApiError.badRequest('The assignee has already finished their step');
    from = ticket.raisedFor;
    set = { raisedFor: employeeId };
    label = 'Assignee';
  } else if (ticket.pipeline === P.CUSTOM) {
    const i = (ticket.customSteps || []).findIndex((s) => s.key === stepKey);
    if (i === -1) throw ApiError.badRequest('Pick the step to reassign');
    if (stepIndex((s) => s.key === stepKey) <= reachedIdx) throw ApiError.badRequest('That step is already done');
    from = ticket.customSteps[i].assignee;
    set = { [`customSteps.${i}.assignee`]: employeeId, ...(i === 0 ? { raisedFor: employeeId } : {}) };
    label = ticket.customSteps[i].label;
  } else {
    const valid = ticket.pipeline === P.POST ? ['designer'] : ticket.pipeline === P.REEL ? ['shooter', 'editor', 'contentManager'] : [];
    if (!valid.includes(field)) throw ApiError.badRequest('Pick the role to reassign');
    const idx = stepIndex((s) => s.actor?.type === 'assignment' && s.actor.field === field);
    // A post's SMM acts on several steps; only block once all are done.
    const lastIdx = steps.reduce((acc, s, i) => (s.actor?.type === 'assignment' && s.actor.field === field ? i : acc), idx);
    if (lastIdx <= reachedIdx) throw ApiError.badRequest("That person's steps are already done");
    from = ticket.assignments?.[field];
    set = { [`assignments.${field}`]: employeeId, ...((field === 'designer' || field === 'shooter') ? { raisedFor: employeeId } : {}) };
    label = pipe.actorLabel({ type: 'assignment', field }, ticket);
  }
  if (idOf(from) === idOf(employeeId)) return toView(user, ticket, chart);

  await Ticket.updateOne({ _id: ticket._id }, { $set: set });
  const updated = await Ticket.findById(ticket._id);
  const names = await peopleMap([from, employeeId]);
  await record(updated, EV.REASSIGNED, user, {
    actingAs: postLabel(user, chart),
    changes: [{ field: label, from: nameOf(names.get(idOf(from))), to: nameOf(names.get(idOf(employeeId))) }],
    note: note?.trim() || '',
  });
  await notify([], [employeeId], {
    type: NT.TICKET_RAISED,
    title: `Ticket ${codeOf(updated.number)} handed to you`,
    message: `You are now "${label}" on "${updated.title}".`,
    ticket: updated,
  }, user.id);
  return toView(user, updated, chart);
}


// Work pipelines: the Team Lead, CEO and admin change anyone, from any team,
// at any point; the team's Content Manager anyone in their team; whoever
// raised it, people they could raise it for.
const WORK_FIELDS = {
  general: ['raisedFor', 'approver'],
  reel_v2: ['contentManager', 'shooter', 'editor', 'smm'],
  post_v2: ['designer', 'smm', 'contentManager'],
  story_v2: ['smm', 'contentManager'],
};
async function reassignWork(user, ticket, chart, { field, employeeId, note }) {
  if (!isOpen(ticket)) throw ApiError.conflict('This ticket is closed');
  const fields = WORK_FIELDS[ticket.pipeline] || [];
  if (!fields.includes(field)) throw ApiError.badRequest('Pick the role to change');
  const target = await Employee.findById(employeeId).select('_id status').lean();
  if (!target) throw ApiError.badRequest('That person was not found');
  if (!picksFromAnyTeam(user)) {
    const cmOfTeam = managesTicket(user, ticket, chart);
    const inTeam = ticket.team ? org.teamMembers(chart, ticket.team).includes(idOf(employeeId)) : false;
    if (cmOfTeam && !inTeam) throw ApiError.forbidden('A Content Manager can choose people in their own team — the Team Lead or CEO can choose from any team');
    if (!cmOfTeam) {
      if (!canEdit(user, ticket)) throw ApiError.forbidden('Only the team’s Content Manager, the Team Lead, the CEO, admin or whoever raised it can change people on it');
      if (!(await org.canRaiseFor(user, employeeId, chart))) throw ApiError.forbidden('You can only hand a ticket to people in your own box or below');
    }
  }
  // Not a step that is already behind it.
  const steps = pipe.stepsFor(ticket);
  const reached = pipe.currentIndex(ticket);
  const usesField = (s) => (field === 'raisedFor' ? s.actor?.type === 'raised_for' : field === 'approver' ? s.actor?.type === 'approver' : s.actor?.type === 'assignment' && s.actor.field === field);
  const last = steps.reduce((acc, s, i) => (usesField(s) ? i : acc), -1);
  const plannerLeft = field === 'contentManager' && steps.some((s, i) => i > reached && (s.actor?.type === 'planner'));
  if (last <= reached && !plannerLeft) throw ApiError.badRequest("That person's steps are already done");

  let from;
  let set;
  if (field === 'raisedFor') {
    from = ticket.raisedFor;
    set = { raisedFor: employeeId };
  } else if (field === 'approver') {
    from = ticket.approver || ticket.raisedByEmployee;
    set = { approver: employeeId, approverUser: null };
  } else {
    from = ticket.assignments?.[field] || (field === 'smm' ? ticket.smm : null);
    set = { [`assignments.${field}`]: employeeId };
    if (field === 'smm') set.smm = employeeId;
    // Who the ticket is "for" follows its first doer.
    const firstDoer = { reel_v2: 'contentManager', post_v2: 'designer', story_v2: 'smm' }[ticket.pipeline];
    if (field === firstDoer) set.raisedFor = employeeId;
  }
  if (idOf(from) === idOf(employeeId)) return toView(user, ticket, chart);
  await Ticket.updateOne({ _id: ticket._id }, { $set: set });
  const updated = await Ticket.findById(ticket._id);
  const names = await peopleMap([from, employeeId]);
  const label = field === 'raisedFor' ? 'Assignee' : field === 'approver' ? 'Approver' : wp.ROLE_LABEL[field];
  await record(updated, EV.REASSIGNED, user, {
    actingAs: postLabel(user, chart),
    changes: [{ field: label, from: nameOf(names.get(idOf(from))), to: nameOf(names.get(idOf(employeeId))) }],
    note: note?.trim() || '',
  });
  if (!updated.locked) {
    await notify([], [employeeId], {
      type: NT.TICKET_RAISED,
      title: `Ticket ${codeOf(updated.number)} handed to you`,
      message: `You are now "${label}" on "${updated.title}".`,
      ticket: updated,
    }, user.id);
  }
  return toView(user, updated, chart);
}

async function comment(user, id, { text }) {
  const chart = await org.loadChart();
  const ticket = await loadViewable(user, id, chart);
  if (!text?.trim()) throw ApiError.badRequest('Write something first');
  await record(ticket, EV.COMMENTED, user, { actingAs: postLabel(user, chart), note: text.trim() });
  const involved = await involvedEmployees(ticket, chart);
  await notify([ticket.raisedBy], [...involved], {
    type: NT.TICKET_COMMENT,
    title: `New comment on ${codeOf(ticket.number)}`,
    message: `"${ticket.title}": ${text.trim().slice(0, 140)}`,
    ticket,
  }, user.id);
  return toView(user, ticket, chart, { withRecord: true });
}

async function addLink(user, id, { url, label }) {
  const chart = await org.loadChart();
  const ticket = await loadViewable(user, id, chart);
  const link = { url: url.trim(), label: label?.trim() || '', addedBy: user.id, at: new Date() };
  await Ticket.updateOne({ _id: ticket._id }, { $push: { links: link } });
  const updated = await Ticket.findById(ticket._id);
  await record(updated, EV.LINK_ADDED, user, { actingAs: postLabel(user, chart), note: link.label, meta: { url: link.url } });
  return toView(user, updated, chart, { withRecord: true });
}

// ---- the CEO's section --------------------------------------------------------------

async function ceoReview(user, id, { note }) {
  if (!seesEveryone(user)) throw ApiError.forbidden('Only the CEO or admin reviews submitted tickets');
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  if (!ticket.submittedToCeoAt) throw ApiError.badRequest('This ticket has not been submitted yet');
  if (ticket.ceoReviewedAt) throw ApiError.conflict('Already reviewed');
  const now = new Date();
  await Ticket.updateOne({ _id: ticket._id }, { $set: { ceoReviewedAt: now, ceoReviewedBy: user.id, ceoReviewNote: note?.trim() || '' } });
  const updated = await Ticket.findById(ticket._id);
  await record(updated, EV.CEO_REVIEWED, user, { actingAs: isCeo(user) ? 'CEO' : 'Admin', note: note?.trim() || '', toColor: pipe.colorFor(updated, now) });
  return toView(user, updated, chart, { withRecord: true });
}

// ---- analysis ----------------------------------------------------------------------

async function analysis(user, { from, to, pipeline, team, person } = {}) {
  if (!seesEveryone(user)) throw ApiError.forbidden('Only the CEO and admin see ticket analysis');
  const filter = {};
  if (from || to) filter.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  if (pipeline) filter.pipeline = pipeline;
  if (team) filter.team = team;
  const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).limit(2000);
  const events = await TicketEvent.find({ ticket: { $in: tickets.map((t) => t._id) } }).sort({ at: 1, _id: 1 }).lean();
  const byTicket = new Map();
  for (const e of events) {
    const k = idOf(e.ticket);
    if (!byTicket.has(k)) byTicket.set(k, []);
    byTicket.get(k).push(e);
  }
  const people = await peopleMap(tickets.flatMap((t) => [t.raisedFor]));
  const users = await userMap(tickets.map((t) => t.raisedBy));
  const now = new Date();

  const rows = [];
  const perPerson = new Map(); // name → { done, onTime, late, totalMs, sentBackWork, sentBackOthers }
  const bump = (name, key, by = 1) => {
    if (!name) return;
    if (!perPerson.has(name)) perPerson.set(name, { name, done: 0, onTime: 0, late: 0, totalMs: 0, workSentBack: 0, sentBackOthers: 0, steps: 0 });
    perPerson.get(name)[key] += by;
  };
  const stepTotals = new Map(); // `${pipeline}|${stage}` → { label, color, ms, count }

  for (const t of tickets) {
    const evs = byTicket.get(idOf(t._id)) || [];
    if (person && idOf(t.raisedFor) !== idOf(person) && !evs.some((e) => idOf(e.byEmployee) === idOf(person))) continue;
    const stepMs = t.metrics?.stepMs instanceof Map ? Object.fromEntries(t.metrics.stepMs) : t.metrics?.stepMs || {};
    // Time at the current step so far, for open tickets.
    if (t.status === TICKET_STATUS.OPEN) stepMs[t.stage] = (stepMs[t.stage] || 0) + Math.max(0, now - new Date(t.metrics?.lastMovedAt || t.createdAt));
    const end = t.completedAt || t.rejectedAt || now;
    const totalMs = end - new Date(t.createdAt);
    const onTime = t.completedAt ? new Date(t.completedAt) <= new Date(t.dueAt) : null;

    // Whose work was sent back: whoever last moved the ticket into the step
    // being reverted.
    const lastInto = new Map();
    for (const e of evs) {
      if (e.type === EV.ADVANCED || e.type === EV.RESTARTED) {
        lastInto.set(e.toStage, e.byName);
        bump(e.byName, 'steps');
      }
      if (e.type === EV.SENT_BACK) {
        bump(lastInto.get(e.fromStage), 'workSentBack');
        bump(e.byName, 'sentBackOthers');
      }
      if (e.type === EV.COMPLETED) {
        const finisher = e.byName;
        bump(finisher, 'done');
      }
    }
    const assignee = nameOf(people.get(idOf(t.raisedFor)));
    if (t.status === TICKET_STATUS.COMPLETED) {
      bump(assignee, onTime ? 'onTime' : 'late');
      bump(assignee, 'totalMs', totalMs);
    }
    for (const [stage, ms] of Object.entries(stepMs)) {
      const key = `${t.pipeline}|${t.pipeline === P.CUSTOM ? 'custom' : stage}`;
      if (!stepTotals.has(key)) {
        stepTotals.set(key, {
          pipeline: PIPELINE_NAME[t.pipeline],
          step: t.pipeline === P.CUSTOM ? 'Custom steps' : pipe.stepLabel(t, stage),
          color: t.pipeline === P.CUSTOM ? null : pipe.stepColor(t, stage),
          ms: 0,
          count: 0,
        });
      }
      const s = stepTotals.get(key);
      s.ms += ms;
      s.count += 1;
    }
    const slowest = Object.entries(stepMs).sort((a, b) => b[1] - a[1])[0];
    rows.push({
      _id: idOf(t._id),
      code: codeOf(t.number),
      title: t.title,
      pipeline: PIPELINE_NAME[t.pipeline],
      team: t.teamName || '',
      clientName: t.clientName || '',
      priority: t.priority,
      raisedBy: userName(users.get(idOf(t.raisedBy))),
      raisedFor: assignee,
      status: t.status,
      color: pipe.colorFor(t, now),
      stageLabel: pipe.stepLabel(t, t.stage),
      createdAt: t.createdAt,
      dueAt: t.dueAt,
      completedAt: t.completedAt || null,
      rejectedAt: t.rejectedAt || null,
      onTime,
      wentOverdue: Boolean(t.overdueAt) || (t.status === TICKET_STATUS.OPEN && new Date(t.dueAt) < now),
      totalMs,
      reverts: t.metrics?.reverts || 0,
      events: evs.length,
      stepTimes: Object.entries(stepMs).map(([stage, ms]) => ({ stage, label: pipe.stepLabel(t, stage), color: pipe.stepColor(t, stage), ms })),
      slowestStep: slowest ? { label: pipe.stepLabel(t, slowest[0]), ms: slowest[1] } : null,
      ceoReviewed: Boolean(t.ceoReviewedAt),
    });
  }

  const completed = rows.filter((r) => r.status === TICKET_STATUS.COMPLETED);
  return {
    totals: {
      tickets: rows.length,
      open: rows.filter((r) => r.status === TICKET_STATUS.OPEN).length,
      completed: completed.length,
      rejected: rows.filter((r) => r.status === TICKET_STATUS.REJECTED).length,
      onTime: completed.filter((r) => r.onTime).length,
      late: completed.filter((r) => r.onTime === false).length,
      reverts: rows.reduce((a, r) => a + r.reverts, 0),
      avgTurnaroundMs: completed.length ? Math.round(completed.reduce((a, r) => a + r.totalMs, 0) / completed.length) : null,
    },
    steps: [...stepTotals.values()].map((s) => ({ ...s, avgMs: Math.round(s.ms / s.count) })).sort((a, b) => b.avgMs - a.avgMs),
    people: [...perPerson.values()]
      .map((p) => ({ ...p, avgTurnaroundMs: p.onTime + p.late ? Math.round(p.totalMs / (p.onTime + p.late)) : null }))
      .sort((a, b) => b.steps - a.steps),
    rows,
  };
}

// ---- overdue sweep -------------------------------------------------------------------

// Stamps every open ticket whose due date has passed, once, in its record.
async function sweepOverdue(now = new Date()) {
  const due = await Ticket.find({ status: TICKET_STATUS.OPEN, isRejected: false, dueAt: { $lt: now }, overdueAt: null, locked: { $ne: true }, parkedIn: null });
  if (!due.length) return 0;
  const chart = await org.loadChart();
  let count = 0;
  for (const t of due) {
    /* eslint-disable no-await-in-loop */
    const res = await Ticket.updateOne({ _id: t._id, overdueAt: null }, { $set: { overdueAt: now } });
    if (!res.modifiedCount) continue;
    await record(t, EV.OVERDUE, null, {
      fromStage: t.stage,
      toStage: t.stage,
      fromLabel: pipe.stepLabel(t, t.stage),
      toLabel: pipe.stepLabel(t, t.stage),
      fromColor: pipe.baseColor(t),
      toColor: pipe.colorFor(t, now),
      note: `Due ${new Date(t.dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} passed`,
    });
    const step = pipe.nextStep(t);
    const actors = step ? await actorsFor(t, step, chart) : { userIds: [], employeeIds: [] };
    await notify([t.raisedBy, ...actors.userIds], actors.employeeIds, {
      type: NT.TICKET_OVERDUE,
      title: `Ticket ${codeOf(t.number)} is overdue`,
      message: `"${t.title}" passed its due date at "${pipe.stepLabel(t, t.stage)}".`,
      ticket: t,
    });
    count += 1;
    /* eslint-enable no-await-in-loop */
  }
  if (count) logger.info({ count }, 'Tickets marked overdue');
  return count;
}

module.exports = {
  meta,
  list,
  get,
  summary,
  raise,
  advance,
  sendBack,
  reject,
  edit,
  reassign,
  comment,
  addLink,
  ceoReview,
  analysis,
  sweepOverdue,
  // for the calendar tickets, repeats, planning and tests
  canViewTicket,
  record,
  seesEveryone,
  actorsFor,
  actingContext,
  codeOf,
  isOpen,
  canView,
  start,
  startMany,
  pickUp,
  hold,
  resume,
  releaseScheduled,
  moveByShoot,
  parkedNow,
  managesTicket,
};
