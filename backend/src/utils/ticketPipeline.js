// The step tables, step names and colours a ticket follows — pure, no
// database. Story, Post and Reel are the content calendar's own tables
// (config/cmsPipelines.js) and colours (CMS_STAGE_COLORS), read straight from
// there so a ticket and a calendar item can never disagree. Custom steps carry
// their own colour, as meeting-minute pipelines always have. Simple uses only
// colours the palette already has. Pink (sent back), red (rejected) and grey
// (overdue) layer on top exactly as they do on the calendar.
const cmsPipelines = require('../config/cmsPipelines');
const wp = require('../config/workPipelines');
const { CMS_STAGE_COLORS, TICKET_PIPELINE } = require('../config/constants');

const P = TICKET_PIPELINE;

// One-person job: the person it's for does it, the raiser closes it.
// orange (open) → green (done) → cream (closed) — the post palette's own.
const SIMPLE_COLORS = {
  created: CMS_STAGE_COLORS.post.created,
  done: CMS_STAGE_COLORS.post.smm_done,
  closed: CMS_STAGE_COLORS.post.done,
};
const SIMPLE_STEPS = [
  { key: 'created', actor: null },
  { key: 'done', actor: { type: 'raised_for' } },
  { key: 'closed', actor: { type: 'raiser' }, terminal: true },
];

// What each step is called once reached.
const STEP_LABELS = {
  [P.SIMPLE]: { created: 'Raised', done: 'Done', closed: 'Closed' },
  [P.STORY]: { created: 'Created', smm_done: 'Story made', lead_done: 'Approved by Team Lead' },
  [P.POST]: {
    created: 'Created',
    smm_done: 'Designed',
    lead_approved: 'Approved by Team Lead',
    sent_to_client: 'Sent to client',
    client_approved: 'Client approved',
    done: 'Done',
  },
  [P.REEL]: {
    created: 'Created',
    videographer_done: 'Shot',
    editor_done: 'Edited',
    smm_done: 'Checked by SMM',
    content_manager_done: 'Approved by Content Manager',
    lead_done: 'Approved by Team Lead',
    sent_to_client: 'Sent to client',
    client_approved: 'Client approved',
    done: 'Done',
  },
};

const ASSIGNMENT_ROLE = {
  designer: 'Social Media Manager',
  shooter: 'Videographer',
  editor: 'Video Editor',
  contentManager: 'Content Manager',
};

const ROLE_NAME = {
  social_media_manager: 'Social Media Manager',
  content_manager: 'Content Manager',
  videographer: 'Videographer',
  editor: 'Video Editor',
};

// Who a step waits on, in words — "Social Media Manager", "Team Lead".
function actorLabel(actor, ticket) {
  if (!actor) return null;
  if (wp.isWorkPipeline(ticket?.pipeline) && actor.type === 'assignment') return wp.ROLE_LABEL[actor.field] || 'Assigned person';
  switch (actor.type) {
    case 'planner':
      return 'Content Manager, Team Lead or CEO';
    case 'tl_ceo':
      return 'Team Lead or CEO';
    case 'approver':
      return 'Approver';
    case 'raised_for':
      return 'Assignee';
    case 'raiser':
      return 'Raised by';
    case 'direct': {
      const step = (ticket?.customSteps || []).find((s) => s.key === actor.stepKey);
      return step?.label || 'Assigned person';
    }
    case 'assignment':
      return ASSIGNMENT_ROLE[actor.field] || 'Assigned person';
    case 'team_role':
      return ROLE_NAME[actor.role] || actor.role;
    case 'global_team_lead':
      return 'Team Lead';
    case 'smm_or_lead':
      return 'Social Media Manager or Team Lead';
    default:
      return null;
  }
}

function stepsFor(ticket) {
  if (wp.isWorkPipeline(ticket.pipeline)) return wp.PIPELINES[ticket.pipeline].steps;
  if (ticket.pipeline === P.SIMPLE) return SIMPLE_STEPS;
  if (ticket.pipeline === P.CUSTOM) {
    const custom = ticket.customSteps || [];
    return [
      { key: 'created', actor: null },
      ...custom.map((s, i) => ({ key: s.key, actor: { type: 'direct', stepKey: s.key }, terminal: i === custom.length - 1 })),
    ];
  }
  return cmsPipelines.stepsFor(ticket.pipeline);
}

function stepColor(ticket, key) {
  if (wp.isWorkPipeline(ticket.pipeline)) return wp.PIPELINES[ticket.pipeline].steps.find((s) => s.key === key)?.color;
  if (ticket.pipeline === P.SIMPLE) return SIMPLE_COLORS[key];
  if (ticket.pipeline === P.CUSTOM) {
    if (key === 'created') return CMS_STAGE_COLORS.post.created;
    return (ticket.customSteps || []).find((s) => s.key === key)?.color;
  }
  return CMS_STAGE_COLORS[ticket.pipeline]?.[key];
}

function stepLabel(ticket, key) {
  if (wp.isWorkPipeline(ticket.pipeline)) return wp.PIPELINES[ticket.pipeline].steps.find((s) => s.key === key)?.label || key;
  if (ticket.pipeline === P.CUSTOM) {
    if (key === 'created') return 'Raised';
    return (ticket.customSteps || []).find((s) => s.key === key)?.label || key;
  }
  return STEP_LABELS[ticket.pipeline]?.[key] || key;
}

function currentIndex(ticket) {
  const i = stepsFor(ticket).findIndex((s) => s.key === ticket.stage);
  return i === -1 ? 0 : i;
}

function currentStep(ticket) {
  return stepsFor(ticket)[currentIndex(ticket)];
}

// The step whose person is being waited on.
function nextStep(ticket) {
  return stepsFor(ticket)[currentIndex(ticket) + 1] || null;
}

function isTerminal(ticket) {
  return Boolean(currentStep(ticket)?.terminal);
}

// Same order of precedence as the calendar: red, then pink, then grey for
// past due, else the step's own colour. A finished ticket keeps its final
// colour.
function colorFor(ticket, now = new Date()) {
  if (wp.isWorkPipeline(ticket.pipeline)) {
    if (ticket.isRejected) return wp.COLOR.rejected;
    if (ticket.isSentBack) return wp.COLOR.changes;
    // Locked or waiting in a lineup isn't overdue: nobody holds it.
    if (!ticket.locked && !ticket.parkedIn && !isTerminal(ticket) && ticket.dueAt && new Date(ticket.dueAt) < now) return wp.COLOR.overdue;
    return stepColor(ticket, ticket.stage) || wp.PIPELINES[ticket.pipeline].typeColor;
  }
  if (ticket.isRejected) return CMS_STAGE_COLORS.rejected;
  if (ticket.isSentBack) return CMS_STAGE_COLORS.sent_back;
  if (!isTerminal(ticket) && ticket.dueAt && new Date(ticket.dueAt) < now) return CMS_STAGE_COLORS.overdue;
  return stepColor(ticket, ticket.stage) || stepColor(ticket, 'created');
}

// The step's own colour, ignoring overrides — what the record stores.
function baseColor(ticket, key = ticket.stage) {
  return stepColor(ticket, key);
}

function trail(ticket) {
  const steps = stepsFor(ticket);
  const idx = currentIndex(ticket);
  return steps.map((step, i) => ({
    key: step.key,
    label: stepLabel(ticket, step.key),
    color: stepColor(ticket, step.key),
    actorLabel: actorLabel(step.actor, ticket),
    terminal: Boolean(step.terminal),
    approval: Boolean(step.approval),
    lineupAfter: step.lineupAfter || null,
    reached: i <= idx,
    current: i === idx,
  }));
}

// Every pipeline with its steps and colours, plus the overrides — what the
// screens draw legends and pickers from, so no colour is ever typed twice.
function catalogue() {
  const sample = (pipeline) => ({ pipeline, customSteps: [] });
  const describe = (pipeline) =>
    stepsFor(sample(pipeline)).map((s) => ({
      key: s.key,
      label: stepLabel(sample(pipeline), s.key),
      color: stepColor(sample(pipeline), s.key),
      actorLabel: actorLabel(s.actor, sample(pipeline)),
      terminal: Boolean(s.terminal),
    }));
  const work = Object.entries(wp.PIPELINES).map(([key, p]) => ({
    key,
    name: p.name,
    description: p.description,
    typeColor: p.typeColor,
    phases: p.phases || null,
    steps: p.steps.map((s) => ({ key: s.key, label: s.label, color: s.color, actorLabel: actorLabel(s.actor, { pipeline: key }), terminal: Boolean(s.terminal), approval: Boolean(s.approval), lineupAfter: s.lineupAfter || null })),
  }));
  return {
    // What a new ticket can be raised on; the older tables only show tickets made on them.
    pipelines: [...work, { key: P.CUSTOM, name: 'Custom', description: '2–5 steps of your own, each with a colour and a person.', steps: [] }],
    legacyPipelines: [
      { key: P.SIMPLE, name: 'Simple', steps: describe(P.SIMPLE) },
      { key: P.STORY, name: 'Story (old)', steps: describe(P.STORY) },
      { key: P.POST, name: 'Post (old)', steps: describe(P.POST) },
      { key: P.REEL, name: 'Reel (old)', steps: describe(P.REEL) },
    ],
    workColors: wp.COLOR,
    lineups: wp.LINEUPS,
    overrides: {
      sent_back: CMS_STAGE_COLORS.sent_back,
      rejected: CMS_STAGE_COLORS.rejected,
      overdue: CMS_STAGE_COLORS.overdue,
    },
    // Colours a custom step may use — only ones the palette already has.
    customPalette: [
      ...new Set(
        Object.values(CMS_STAGE_COLORS)
          .filter((v) => typeof v === 'object')
          .flatMap((m) => Object.values(m))
      ),
    ],
  };
}

module.exports = {
  stepsFor,
  stepColor,
  stepLabel,
  actorLabel,
  currentIndex,
  currentStep,
  nextStep,
  isTerminal,
  colorFor,
  baseColor,
  trail,
  catalogue,
  STEP_LABELS,
};
