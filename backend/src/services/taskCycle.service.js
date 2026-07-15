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

// Only 'duration' templates (monthly retainers, e.g. GO-TO x Diamond) are
// recurring. 'quantity' templates (podcast batches, e.g. "4 podcasts") and
// 'fixed' templates (a single one-off podcast) are a single batch of work
// generated once per quotation, never a recurring monthly cycle — see
// GO-TO x PM PREMIUM/PRO/STANDARD and RP GROWTH/PRO PACKAGE, which sell a
// fixed batch of deliverables shot over a few days, not an ongoing retainer.
function isOneTimeTemplate(template) {
  return template.planType === 'quantity' || template.planType === 'fixed';
}

// "4_podcasts" -> 4, "1_podcast" -> 1 — quantity-type planOptionKeys always
// start with the unit count (see quotationTemplate seed data).
function parseQuantityFromPlanOptionKey(planOptionKey) {
  const match = /^(\d+)_/.exec(planOptionKey || '');
  return match ? Number(match[1]) : 1;
}

// Creates whatever recurring cycles are missing to catch a client up to
// "today" — normally that's zero or one, but it correctly backfills multiple
// if the daily job didn't run for a while. Idempotent: re-running finds the
// existing latest cycle and does nothing further once it covers today.
async function ensureCurrentCycle(client, quotation) {
  if (!client.onboardedAt) return null;

  const today = startOfUTCDay(new Date());
  let latest = await taskCycleRepository.findLatestForClient(client._id);

  if (!latest) {
    const startDate = startOfUTCDay(new Date(client.onboardedAt));
    const endDate = new Date(addMonthsClamped(startDate, 1).getTime() - MS_PER_DAY);
    latest = await taskCycleRepository.create({
      client: client._id,
      quotation: quotation._id,
      kind: 'recurring',
      cycleNumber: 1,
      startDate,
      endDate,
    });
  }

  while (latest.endDate < today) {
    const startDate = new Date(latest.endDate.getTime() + MS_PER_DAY);
    const endDate = new Date(addMonthsClamped(startDate, 1).getTime() - MS_PER_DAY);
    // eslint-disable-next-line no-await-in-loop
    latest = await taskCycleRepository.create({
      client: client._id,
      quotation: quotation._id,
      kind: 'recurring',
      cycleNumber: latest.cycleNumber + 1,
      startDate,
      endDate,
    });
  }

  return latest;
}

// Finds (or creates) the single one_time cycle tied to this quotation — a
// client that signs a new quantity/fixed-plan quotation later (another
// batch of podcasts) gets a fresh cycle of its own, numbered after whatever
// cycles already exist for them.
async function ensureBatchForQuotation(client, quotation) {
  let cycle = await taskCycleRepository.findByQuotation(quotation._id);
  if (!cycle) {
    const cycleNumber = await taskCycleRepository.nextCycleNumberForClient(client._id);
    cycle = await taskCycleRepository.create({
      client: client._id,
      quotation: quotation._id,
      kind: 'one_time',
      cycleNumber,
      startDate: startOfUTCDay(new Date()),
    });
  }
  return cycle;
}

// Expands the cycle's own quotation's template Scope of Work into one Task
// per deliverable instance — a no-op if generation already happened
// (idempotent) or that template has no Scope of Work configured yet.
// Reads the template from cycle.quotation (snapshotted at cycle-creation
// time) rather than the client's current quotation, so a later plan change
// never retroactively alters an already-generated cycle.
async function generateTasksForCycle(cycle) {
  if (!cycle || cycle.tasksGeneratedAt) return [];
  if (!cycle.quotation) return [];

  const quotation = await quotationRepository.findById(cycle.quotation);
  const template = quotation?.template;
  if (!template || !template.scopeOfWork || template.scopeOfWork.length === 0) return [];

  const multiplier = template.planType === 'quantity'
    ? parseQuantityFromPlanOptionKey(quotation.planOptionKey)
    : 1;
  const cycleDays = cycle.endDate
    ? Math.round((cycle.endDate.getTime() - cycle.startDate.getTime()) / MS_PER_DAY) + 1
    : 1;

  const taskDocs = [];
  for (const section of template.scopeOfWork) {
    const steps = [...section.steps]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ label: s.label, order: s.order }));
    for (const item of section.items) {
      const perUnitQty = item.perDay ? item.qtyPerCycle * cycleDays : item.qtyPerCycle;
      const qty = perUnitQty * multiplier;
      for (let i = 0; i < qty; i += 1) {
        taskDocs.push({
          client: cycle.client,
          cycle: cycle._id,
          quotationTemplate: template._id,
          sectionName: section.name,
          itemLabel: qty > 1 ? `${item.label} #${i + 1}` : item.label,
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

// Runs the full per-client pipeline: catch up on cycles (or spin up a
// one-time batch), generate tasks if not already done. Exported standalone
// so an admin action ("sync tasks now"), the post-signing hook, and the
// daily cron all share the exact same logic.
async function syncClientCycle(clientId) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');
  if (client.status !== CLIENT_STATUS.ONBOARDED) return { client, cycle: null, tasks: [] };
  if (!client.currentQuotation) return { client, cycle: null, tasks: [] };

  const quotation = await quotationRepository.findById(client.currentQuotation);
  const template = quotation?.template;
  if (!quotation || !template) return { client, cycle: null, tasks: [] };

  const cycle = isOneTimeTemplate(template)
    ? await ensureBatchForQuotation(client, quotation)
    : await ensureCurrentCycle(client, quotation);

  const tasks = await generateTasksForCycle(cycle);
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
