// The work pipelines (from the client's sheets, November 2026): Reel, Post,
// Story and General — read by utils/ticketPipeline.js beside the older
// tables, which stay only so tickets made on them still show correctly.
//
// A step: { key, label (once reached), actor (who it waits on), color (the
// ticket's colour once it is reached), approval (a check, not work — its
// time is a short review), lineupAfter (reaching it puts the ticket in that
// lineup: done with a phase, waiting for the next to begin, nobody holding
// it, no time counting), needsDate / needsLink (asked when completing it),
// terminal }.
//
// Actors:
//   planner  — the team's Content Manager, the Team Lead or the CEO
//   tl_ceo   — the Team Lead or the CEO
//   { type: 'assignment', field } — the person named on the ticket for that
//              role: designer, shooter (videographer), editor,
//              contentManager, smm
//   raised_for / approver — General: the person doing it; whoever approves
//              (chosen when raising, else the raiser)
// The CEO and admin may complete any step (as today); client approval
// steps come later — the Team Lead or CEO approves in the client's place.

const COLOR = {
  // A ticket's type — its colour when made.
  general: '#9ca3af', // grey
  reel: '#e1ad01', // mustard yellow
  post: '#f97316', // orange
  story: '#795548', // brown (story and festive story)
  meeting: '#111827', // black (meetings on the Weekly Calendar)
  // Steps reached.
  shoot: '#2563eb', // blue
  dataTransfer: '#06b6d4', // cyan
  workDone: '#22c55e', // green
  cmApproved: '#800000', // maroon
  leadApproved: '#1e3a8a', // dark blue
  clientTransfer: '#8fdc35', // toxic frog — later
  clientApproved: '#a855f7', // purple — later
  scheduled: '#007fff', // azure blue
  uploaded: '#e6d9b8', // cream
  // Overrides.
  changes: '#ff4fbf', // neon pink — sent back
  rejected: '#ff1f3d', // neon red
  overdue: '#e6ff00', // neon yellow
};

const PLANNER = { type: 'planner' };
const TL_CEO = { type: 'tl_ceo' };
const as = (field) => ({ type: 'assignment', field });

const CALENDAR_STEPS = [
  { key: 'scheduled', label: 'Scheduled', actor: as('contentManager'), color: COLOR.scheduled, needsDate: true },
  { key: 'uploaded', label: 'Uploaded', actor: as('smm'), color: COLOR.uploaded, needsLink: true, terminal: true },
];

const PIPELINES = {
  reel_v2: {
    name: 'Reel',
    typeColor: COLOR.reel,
    description: 'Plan of action, shoot, then edit — up to posting.',
    phases: [
      { key: 'poa', label: 'Plan of action', from: 'topic', to: 'script_approved' },
      { key: 'shoot', label: 'Shoot', from: 'shoot_planned', to: 'data_transferred' },
      { key: 'edit', label: 'Edit', from: 'edited', to: 'uploaded' },
    ],
    steps: [
      { key: 'created', label: 'Task created', actor: null, color: COLOR.reel },
      { key: 'topic', label: 'Topic written', actor: PLANNER, color: COLOR.workDone },
      { key: 'topic_approved', label: 'Topic approved', actor: TL_CEO, color: COLOR.leadApproved, approval: true },
      { key: 'script', label: 'Script written', actor: PLANNER, color: COLOR.workDone },
      { key: 'script_approved', label: 'Script approved', actor: TL_CEO, color: COLOR.leadApproved, approval: true, lineupAfter: 'shoot' },
      // Both reached through a shoot (services/shootSession.service.js).
      { key: 'shoot_planned', label: 'Shoot planned', actor: as('shooter'), color: COLOR.shoot, viaShoot: true },
      { key: 'shot', label: 'Shot', actor: as('shooter'), color: COLOR.shoot, viaShoot: true },
      { key: 'data_transferred', label: 'Data transferred', actor: as('shooter'), color: COLOR.dataTransfer, needsLink: true, lineupAfter: 'editing' },
      { key: 'edited', label: 'Edited', actor: as('editor'), color: COLOR.workDone },
      { key: 'cm_approved', label: 'Approved by Content Manager', actor: as('contentManager'), color: COLOR.cmApproved, approval: true },
      { key: 'lead_approved', label: 'Approved by TL/CEO', actor: TL_CEO, color: COLOR.leadApproved, approval: true, lineupAfter: 'calendar' },
      ...CALENDAR_STEPS,
    ],
  },
  post_v2: {
    name: 'Post',
    typeColor: COLOR.post,
    description: 'Designing, the Social Media Manager’s and TL/CEO approval, then posting.',
    steps: [
      { key: 'created', label: 'Task created', actor: null, color: COLOR.post },
      { key: 'designed', label: 'Designed', actor: as('designer'), color: COLOR.workDone },
      { key: 'smm_approved', label: 'Approved by Social Media Manager', actor: as('smm'), color: COLOR.cmApproved, approval: true },
      { key: 'lead_approved', label: 'Approved by TL/CEO', actor: TL_CEO, color: COLOR.leadApproved, approval: true, lineupAfter: 'calendar' },
      ...CALENDAR_STEPS,
    ],
  },
  story_v2: {
    name: 'Story',
    typeColor: COLOR.story,
    description: 'The Social Media Manager makes it, the Content Manager and TL/CEO approve, then posting.',
    steps: [
      { key: 'created', label: 'Task created', actor: null, color: COLOR.story },
      { key: 'designed', label: 'Story made', actor: as('smm'), color: COLOR.workDone },
      { key: 'cm_approved', label: 'Approved by Content Manager', actor: as('contentManager'), color: COLOR.cmApproved, approval: true },
      { key: 'lead_approved', label: 'Approved by TL/CEO', actor: TL_CEO, color: COLOR.leadApproved, approval: true, lineupAfter: 'calendar' },
      ...CALENDAR_STEPS,
    ],
  },
  general: {
    name: 'General',
    typeColor: COLOR.general,
    description: 'Someone does the work; the approver (you, unless you choose someone) approves and closes it.',
    steps: [
      { key: 'created', label: 'Task created', actor: null, color: COLOR.general },
      { key: 'done', label: 'Work done', actor: { type: 'raised_for' }, color: COLOR.workDone },
      { key: 'closed', label: 'Approved & closed', actor: { type: 'approver' }, color: COLOR.uploaded, approval: true, terminal: true },
    ],
  },
};

// Where a ticket waits between phases, and how it leaves.
const LINEUPS = {
  shoot: { label: 'Shoot lineup', leaves: 'when a shoot is planned with it' },
  editing: { label: 'Editing lineup', leaves: 'when the editor starts editing' },
  calendar: { label: 'Calendar lineup', leaves: 'when the Content Manager schedules it' },
  posting: { label: 'Scheduled', leaves: 'on its posting date' },
  shoot_day: { label: 'Shoot planned', leaves: 'on the shoot day' },
  hold: { label: 'On hold', leaves: 'when it is resumed' },
};

// What each assignment field is called.
const ROLE_LABEL = {
  designer: 'Designer',
  shooter: 'Videographer',
  editor: 'Video Editor',
  contentManager: 'Content Manager',
  smm: 'Social Media Manager',
};

module.exports = { COLOR, PIPELINES, LINEUPS, ROLE_LABEL, isWorkPipeline: (key) => Boolean(PIPELINES[key]) };
