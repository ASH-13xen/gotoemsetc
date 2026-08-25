// The Task-Management-originated half of "two entry points, one action" —
// see calendarItem.service.js#advance for the calendar-originated half.
// Required lazily from employeeTask.service.js (which the CMS services
// already import the other direction) to avoid a load-time circular
// require; safe to require calendarItemService at the top here since by the
// time this module is actually loaded, that one already is.
const calendarItemRepository = require('../../repositories/calendarItem.repository');
const clientCalendarRepository = require('../../repositories/clientCalendar.repository');
const calendarItemService = require('../calendarItem.service');
const cmsWorkflow = require('../cmsWorkflow.service');

async function loadTeam(item) {
  const calendar = await clientCalendarRepository.findById(item.calendar);
  return calendar?.team;
}

// A subtask just got marked completed in Task Management. If it happens to
// be the one backing its CalendarItem's currently-active step, that
// completion IS the pending pipeline action — advance it, exactly as if the
// same person had clicked "advance" in the Client Management calendar
// instead. Any mismatch (out-of-band completion, a step that already moved
// on) is expected and harmless: silently do nothing.
async function onSubtaskCompleted(task, actingUser) {
  if (!task.cmsItem) return;

  const item = await calendarItemRepository.findById(task.cmsItem);
  if (!item || item.isRejected) return;

  const step = cmsWorkflow.nextStepConfig(item);
  if (!step?.subtaskRole) return;

  const refKey = calendarItemService.SUBTASK_REF_KEY[step.subtaskRole];
  const activeSubtaskId = item.subtaskRefs?.[refKey];
  if (!activeSubtaskId || activeSubtaskId.toString() !== task._id.toString()) return;

  if (!cmsWorkflow.canActOnCurrentStep(actingUser, item, await loadTeam(item))) {
    // The person who completed the subtask in Task Management isn't
    // actually the pipeline's named actor for this step (e.g. an
    // admin/manage_subtasks holder completing on someone's behalf) — the
    // subtask itself is still legitimately completed, but advancing the
    // CMS pipeline stays a separate, explicit action for the right person.
    return;
  }

  await calendarItemService.advance(item._id, actingUser, {});
}

module.exports = { onSubtaskCompleted };
