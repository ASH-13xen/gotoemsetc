const ApiError = require('../utils/ApiError');
const { CLIENT_STATUS, NOTIFICATION_TYPES, DEFAULT_CYCLE_REMINDER_DAYS_BEFORE_END } = require('../config/constants');
const clientRepository = require('../repositories/client.repository');
const quotationRepository = require('../repositories/quotation.repository');
const taskCycleRepository = require('../repositories/taskCycle.repository');
const taskRepository = require('../repositories/task.repository');
const clientActivity = require('./clientActivity.service');
const taskNotify = require('./taskNotify.service');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUTCDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Adds `months` to `date`, clamping the day-of-month to whatever the target
// month actually has (Jan 31 + 1 month lands on Feb 28/29, not Mar 3) — same
// clamping convention as the employee payDate logic elsewhere in this app.
function addMonthsClamped(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
}

// Creates whatever cycles are missing to catch a client up to "today" —
// normally that's zero or one, but it correctly backfills multiple if the
// daily job didn't run for a while. Idempotent: re-running finds the
// existing latest cycle and does nothing further once it covers today.
async function ensureCurrentCycle(client) {
  if (!client.onboardedAt) return null;

  const today = startOfUTCDay(new Date());
  let latest = await taskCycleRepository.findLatestForClient(client._id);

  if (!latest) {
    const startDate = startOfUTCDay(new Date(client.onboardedAt));
    const endDate = new Date(addMonthsClamped(startDate, 1).getTime() - MS_PER_DAY);
    latest = await taskCycleRepository.create({ client: client._id, cycleNumber: 1, startDate, endDate });
  }

  while (latest.endDate < today) {
    const startDate = new Date(latest.endDate.getTime() + MS_PER_DAY);
    const endDate = new Date(addMonthsClamped(startDate, 1).getTime() - MS_PER_DAY);
    // eslint-disable-next-line no-await-in-loop
    latest = await taskCycleRepository.create({
      client: client._id,
      cycleNumber: latest.cycleNumber + 1,
      startDate,
      endDate,
    });
  }

  return latest;
}

// Expands a template's Scope of Work into one Task per deliverable instance
// for this cycle — a no-op if generation already happened (idempotent) or
// the client has no signed quotation / the quotation's template has no
// Scope of Work configured yet.
async function generateTasksForCycle(client, cycle) {
  if (!cycle || cycle.tasksGeneratedAt) return [];
  if (!client.currentQuotation) return [];

  const quotation = await quotationRepository.findById(client.currentQuotation);
  const template = quotation?.template;
  if (!template || !template.scopeOfWork || template.scopeOfWork.length === 0) return [];

  const taskDocs = [];
  for (const section of template.scopeOfWork) {
    const steps = [...section.steps]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ label: s.label, order: s.order }));
    for (const item of section.items) {
      for (let i = 0; i < item.qtyPerCycle; i += 1) {
        taskDocs.push({
          client: client._id,
          cycle: cycle._id,
          quotationTemplate: template._id,
          sectionName: section.name,
          itemLabel: item.qtyPerCycle > 1 ? `${item.label} #${i + 1}` : item.label,
          itemIndex: i,
          steps: steps.map((s) => ({ ...s })),
        });
      }
    }
  }

  await taskCycleRepository.markGenerated(cycle._id);
  if (taskDocs.length === 0) return [];
  return taskRepository.insertMany(taskDocs);
}

// Runs the full per-client pipeline: catch up on cycles, generate this
// cycle's tasks if not already done. Exported standalone so an admin action
// ("generate tasks now") and the daily cron share the exact same logic.
async function syncClientCycle(clientId) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');
  if (client.status !== CLIENT_STATUS.ONBOARDED) return { client, cycle: null, tasks: [] };

  const cycle = await ensureCurrentCycle(client);
  const tasks = await generateTasksForCycle(client, cycle);
  return { client, cycle, tasks };
}

// Sweeps every cycle whose end date has passed but hasn't been closed yet —
// marks incomplete tasks "missed" and notifies the client's team so they
// can decide what to roll over (see task.service.js rolloverTask).
async function sweepEndedCycles() {
  const cycles = await taskCycleRepository.listUnclosedEnded();
  let missedTotal = 0;

  for (const cycle of cycles) {
    // eslint-disable-next-line no-await-in-loop
    const incomplete = await taskRepository.listIncompleteForCycle(cycle._id);
    for (const task of incomplete) {
      // eslint-disable-next-line no-await-in-loop
      await taskRepository.updateById(task._id, { status: 'missed' });
    }

    if (incomplete.length > 0) {
      missedTotal += incomplete.length;
      // eslint-disable-next-line no-await-in-loop
      const client = await clientRepository.findById(cycle.client);
      if (client) {
        // eslint-disable-next-line no-await-in-loop
        await taskNotify.notifyClientTeam(client, {
          type: NOTIFICATION_TYPES.CYCLE_ROLLOVER,
          title: `${incomplete.length} task(s) missed — ${client.clientName}`,
          message: `${incomplete.length} task(s) weren't finished before this cycle ended. Review and roll over what's still needed.`,
          client: client._id,
        });
        // eslint-disable-next-line no-await-in-loop
        await clientActivity.log(client._id, 'CYCLE_TASKS_MISSED', { count: incomplete.length, cycleNumber: cycle.cycleNumber });
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await taskCycleRepository.markClosed(cycle._id);
  }

  return { cyclesClosed: cycles.length, tasksMissed: missedTotal };
}

// Notifies each client's team once, a few days before their current cycle
// ends, with how much is still outstanding — skipped entirely if nothing's
// left to do.
async function sendCycleReminders() {
  const threshold = new Date(Date.now() + DEFAULT_CYCLE_REMINDER_DAYS_BEFORE_END * MS_PER_DAY);
  const dueCycles = await taskCycleRepository.listDueForReminder(threshold);
  let sent = 0;

  for (const cycle of dueCycles) {
    // eslint-disable-next-line no-await-in-loop
    const client = await clientRepository.findById(cycle.client);
    if (!client || client.status === CLIENT_STATUS.OFFBOARDED) {
      // eslint-disable-next-line no-await-in-loop
      await taskCycleRepository.markReminderSent(cycle._id);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const tasks = await taskRepository.listForCycle(cycle.client, cycle._id);
    const incomplete = tasks.filter((t) => t.status !== 'done');
    if (incomplete.length === 0) {
      // eslint-disable-next-line no-await-in-loop
      await taskCycleRepository.markReminderSent(cycle._id);
      continue;
    }

    const bySection = {};
    for (const t of incomplete) {
      bySection[t.sectionName] = (bySection[t.sectionName] || 0) + 1;
    }
    const summary = Object.entries(bySection)
      .map(([name, count]) => `${count} ${name}`)
      .join(', ');
    const daysLeft = Math.max(1, Math.ceil((cycle.endDate.getTime() - Date.now()) / MS_PER_DAY));

    // eslint-disable-next-line no-await-in-loop
    await taskNotify.notifyClientTeam(client, {
      type: NOTIFICATION_TYPES.CYCLE_ENDING_SOON,
      title: `Cycle ending soon — ${client.clientName}`,
      message: `${summary} remaining, cycle ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      client: client._id,
    });
    // eslint-disable-next-line no-await-in-loop
    await taskCycleRepository.markReminderSent(cycle._id);
    sent += 1;
  }

  return { remindersSent: sent };
}

async function listCyclesForClient(clientId) {
  return taskCycleRepository.listForClient(clientId);
}

module.exports = {
  addMonthsClamped,
  ensureCurrentCycle,
  generateTasksForCycle,
  syncClientCycle,
  sweepEndedCycles,
  sendCycleReminders,
  listCyclesForClient,
};
