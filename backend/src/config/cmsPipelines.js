// Declarative step tables for the Client Management System's approval
// pipelines — one per CMS_PIPELINE_KIND (story/post/reel). Replaces the old
// single generic 7-stage engine (see git history on cmsWorkflow.service.js)
// with one table per content type, matching the spec's literal per-type
// colour/actor sequences exactly.
//
// Each step is the STAGE REACHED by an action, not the action itself — so
// `smm_done`'s `actor` is who performs the action that produces that stage.
// The first entry in every pipeline (`created`) has `actor: null`: nothing
// transitions an item *into* its own starting stage, it's just where a newly
// scheduled item begins.
//
// `actor` is a small tagged descriptor, interpreted by:
//   - cmsWorkflow.service.js#canActOnCurrentStep (synchronous — is this user
//     allowed to perform the pending action right now)
//   - cmsNotify.service.js (async — whose inbox does the notification land in)
// Kept as data rather than a function so both call sites, plus a future UI
// script, all read one unambiguous source.
//
//   { type: 'team_role', role }   — any employee currently tagged `role` on
//                                    the team may act, collectively (e.g. a
//                                    team with two Social Media Managers —
//                                    either may act, and the work is shown
//                                    as belonging to both)
//   { type: 'assignment', field } — specifically whoever is named in
//                                    CalendarItem.assignments[field] for
//                                    this item (set once, at scheduling)
//   { type: 'global_team_lead' }  — any account holding the team_lead login
//                                    role, company-wide, unrelated to any
//                                    one team's roster
//   { type: 'smm_or_lead' }       — the union of `team_role` SMM and
//                                    `global_team_lead` above
//
// `subtaskRole`, when set, names the CMS_TASK_ROLE this step also exists as
// a Task Management subtask under — completing it there is an equally valid
// way to perform the same action (see calendarItem.service.js#subtaskPlan
// and services/cms/pipelineBridge.service.js).
const { CMS_STORY_STEP, CMS_POST_STEP, CMS_REEL_STEP, CMS_TASK_ROLE, TEAM_MEMBER_ROLE } = require('./constants');

const SMM_ROLE = { type: 'team_role', role: TEAM_MEMBER_ROLE.SOCIAL_MEDIA_MANAGER };
const GLOBAL_LEAD = { type: 'global_team_lead' };
const SMM_OR_LEAD = { type: 'smm_or_lead' };

const CMS_PIPELINES = {
  story: {
    steps: [
      { key: CMS_STORY_STEP.CREATED, actor: null, subtaskRole: null },
      // Backed by that day's own subtask under the shared monthly "Daily
      // Stories" parent — this is the actual work of making the story, not
      // a pure approval click, so it gets the same two-entry-point
      // mechanism as a Reel's doer steps (see calendarItem.service.js#
      // ensureDailyStoryTask).
      { key: CMS_STORY_STEP.SMM_DONE, actor: SMM_ROLE, subtaskRole: CMS_TASK_ROLE.STORY },
      { key: CMS_STORY_STEP.LEAD_DONE, actor: GLOBAL_LEAD, subtaskRole: null, terminal: true },
    ],
  },
  post: {
    steps: [
      { key: CMS_POST_STEP.CREATED, actor: null, subtaskRole: null },
      // Team Main assigns exactly one SMM as assignments.designer at
      // scheduling time — every later SMM-facing step in a post routes back
      // to that same person, not the team's SMM tag-set in general.
      { key: CMS_POST_STEP.SMM_DONE, actor: { type: 'assignment', field: 'designer' }, subtaskRole: CMS_TASK_ROLE.DESIGN },
      { key: CMS_POST_STEP.LEAD_APPROVED, actor: GLOBAL_LEAD, subtaskRole: null },
      { key: CMS_POST_STEP.SENT_TO_CLIENT, actor: { type: 'assignment', field: 'designer' }, subtaskRole: null },
      { key: CMS_POST_STEP.CLIENT_APPROVED, actor: { type: 'assignment', field: 'designer' }, subtaskRole: null },
      { key: CMS_POST_STEP.DONE, actor: SMM_OR_LEAD, subtaskRole: null, terminal: true },
    ],
  },
  reel: {
    steps: [
      { key: CMS_REEL_STEP.CREATED, actor: null, subtaskRole: null },
      { key: CMS_REEL_STEP.VIDEOGRAPHER_DONE, actor: { type: 'assignment', field: 'shooter' }, subtaskRole: CMS_TASK_ROLE.VIDEOGRAPHER },
      { key: CMS_REEL_STEP.EDITOR_DONE, actor: { type: 'assignment', field: 'editor' }, subtaskRole: CMS_TASK_ROLE.EDITOR },
      // Not assignment-pinned — a reel never names one specific SMM at
      // scheduling time, unlike a post's designer field.
      { key: CMS_REEL_STEP.SMM_DONE, actor: SMM_ROLE, subtaskRole: null },
      { key: CMS_REEL_STEP.CONTENT_MANAGER_DONE, actor: { type: 'assignment', field: 'contentManager' }, subtaskRole: CMS_TASK_ROLE.CONTENT_MANAGER },
      { key: CMS_REEL_STEP.LEAD_DONE, actor: GLOBAL_LEAD, subtaskRole: null },
      { key: CMS_REEL_STEP.SENT_TO_CLIENT, actor: SMM_ROLE, subtaskRole: null },
      { key: CMS_REEL_STEP.CLIENT_APPROVED, actor: SMM_ROLE, subtaskRole: null },
      { key: CMS_REEL_STEP.DONE, actor: SMM_OR_LEAD, subtaskRole: null, terminal: true },
    ],
  },
};

// type: 'story' | 'post' | 'reel' | 'festive_story'. Festive stories have no
// table of their own — they borrow post's or reel's, per
// CalendarItem.festiveWorkflow, chosen once at scheduling time.
function pipelineKindFor(item) {
  if (item.type === 'festive_story') return item.festiveWorkflow;
  return item.type;
}

function stepsFor(kind) {
  const pipeline = CMS_PIPELINES[kind];
  if (!pipeline) throw new Error(`Unknown CMS pipeline kind "${kind}"`);
  return pipeline.steps;
}

function currentStepIndex(item) {
  const steps = stepsFor(pipelineKindFor(item));
  const index = steps.findIndex((s) => s.key === item.stage);
  return index === -1 ? 0 : index;
}

function currentStepConfig(item) {
  return stepsFor(pipelineKindFor(item))[currentStepIndex(item)];
}

// The step whose actor is the one currently being waited on — i.e. the
// action that would advance the item off its current stage.
function nextStepConfig(item) {
  const steps = stepsFor(pipelineKindFor(item));
  return steps[currentStepIndex(item) + 1] || null;
}

function isTerminal(item) {
  return Boolean(currentStepConfig(item)?.terminal);
}

module.exports = {
  CMS_PIPELINES,
  pipelineKindFor,
  stepsFor,
  currentStepIndex,
  currentStepConfig,
  nextStepConfig,
  isTerminal,
};
