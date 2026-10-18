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
const PIPELINE_NAME = { simple: 'Simple', story: 'Story', post: 'Post', reel: 'Reel', custom: 'Custom' };
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
  if (actor.type === 'assignment') return one(ticket.assignments?.[actor.field]);

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

// May this person act on the step the ticket is waiting on? Its own people,
// or the CEO/admin for any step.
async function actingContext(user, ticket, chart) {
  if (!isOpen(ticket)) return { canAct: false };
  const step = pipe.nextStep(ticket);
  if (!step) return { canAct: false };
  const actors = await actorsFor(ticket, step, chart);
  const natural = isIn(user, actors);
  const force = !natural && seesEveryone(user);
  if (!natural && !force) return { canAct: false, actors, step };
  const label = pipe.actorLabel(step.actor, ticket);
  const teamSuffix = ['team_role', 'smm_or_lead'].includes(step.actor?.type) && ticket.teamName ? ` · ${ticket.teamName}` : '';
  let actingAs = `${label}${teamSuffix}`;
  let onBehalfOf = null;
  if (force) {
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
  const allEmployeeIds = [ticket.raisedFor, ticket.raisedByEmployee, ticket.smm, ...stepActors.flatMap((a) => a.employeeIds)];
  const people = await peopleMap(allEmployeeIds);
  const users = await userMap([ticket.raisedBy, ticket.ceoReviewedBy, ...stepActors.flatMap((a) => a.userIds), ...(ticket.links || []).map((l) => l.addedBy)]);
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
    can: {
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
  return {
    ...pipe.catalogue(),
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
    },
  };
}

// scope: 'mine' (waiting on me), 'raised' (I raised), 'team' (anyone below
// me), 'all' (CEO/admin), 'submitted' (the CEO's section).
async function list(user, { scope = 'mine', status = 'open', q } = {}) {
  const chart = await org.loadChart();
  const filter = {};
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
      const ctx = await actingContext(user, t, chart);
      if (ctx.canAct && ctx.natural) keep.push(t);
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
  return {
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
// tied to it and its record says so.
async function raise(user, input, { repeatId = null, repeatLabel = null } = {}) {
  const chart = await org.loadChart();
  const raisable = await org.raisableFor(user, chart);
  const { pipeline } = input;
  const mayRaiseFor = (id) => raisable.has(idOf(id));
  const deny = () => ApiError.forbidden('You can only raise tickets for people in your own box or below it in the Organisation chart');

  let raisedFor = input.raisedFor;
  let assignments = {};
  let customSteps = [];
  let team = null;
  let smm = null;
  // People on steps above the person it's raised for (the SMM checking a
  // reel, the team's Content Manager) — chosen, not raised for.
  const approvers = [];

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
  if (!people.every(mayRaiseFor)) throw deny();

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
    repeat: repeatId,
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
    },
  });

  const raiser = (await userMap([user.id])).get(idOf(user.id));
  await notify([], [raisedFor], {
    type: NT.TICKET_RAISED,
    title: `New ticket ${codeOf(number)} — ${ticket.title}`,
    message: `${userName(raiser) || 'Someone'} raised "${ticket.title}" for you, due ${new Date(ticket.dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    ticket,
  }, user.id);
  // The first step's people, when it isn't the person it was raised for.
  await notifyWaiting(ticket, chart, user.id, NT.TICKET_YOUR_STEP, `Ticket ${codeOf(number)} is waiting on you`, `"${ticket.title}" — ${pipe.stepLabel(ticket, pipe.nextStep(ticket)?.key)} is your step.`).catch(() => {});

  return toView(user, ticket, chart);
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

async function advance(user, id, { note } = {}) {
  const chart = await org.loadChart();
  const ticket = await loadOr404(id);
  const ctx = await actingContext(user, ticket, chart);
  if (!ctx.canAct) throw ApiError.forbidden("This step isn't yours to complete");

  const now = new Date();
  const restart = Boolean(ticket.isSentBack);
  const fromColor = pipe.colorFor(ticket, now);
  let moved = await applyMove(ticket, { stage: ctx.step.key, isSentBack: false });
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
  });

  // Same-person auto-skip, as on the calendar: a Team Lead completing a step
  // isn't asked to approve their own work at the Team Lead step right after.
  const following = pipe.nextStep(moved);
  if (following && !pipe.isTerminal(moved) && ['global_team_lead', 'smm_or_lead'].includes(following.actor?.type)) {
    const leads = await org.teamLeads(chart);
    if (isIn(user, { ...leads })) {
      const before = moved;
      moved = await applyMove(moved, { stage: following.key });
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
    }
  }

  if (pipe.isTerminal(moved)) {
    moved = await finishIfTerminal(user, moved, chart);
  } else {
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
  const moved = await applyMove(ticket, { stage: steps[idx - 1].key, isSentBack: true }, { 'metrics.reverts': 1 });
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

// ---- edits, reassigning, comments, links -------------------------------------

const FIELD_LABEL = { title: 'Title', description: 'Description', priority: 'Priority', clientName: 'Client', dueAt: 'Due' };

async function edit(user, id, input) {
  const chart = await org.loadChart();
  const ticket = await loadViewable(user, id, chart);
  if (!canEdit(user, ticket)) throw ApiError.forbidden('Only whoever raised it, the CEO or admin can change an open ticket');

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
  const due = await Ticket.find({ status: TICKET_STATUS.OPEN, isRejected: false, dueAt: { $lt: now }, overdueAt: null });
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
  // for the calendar tickets, repeats and tests
  record,
  seesEveryone,
  actorsFor,
  actingContext,
  codeOf,
};
