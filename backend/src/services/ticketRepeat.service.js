const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const Ticket = require('../models/Ticket');
const TicketRepeat = require('../models/TicketRepeat');
const holidayRepository = require('../repositories/holiday.repository');
const notificationService = require('./notification.service');
const accessService = require('./access.service');
const ticketService = require('./ticket.service');
const { TICKET_REPEAT, TICKET_EVENT, NOTIFICATION_TYPES } = require('../config/constants');

// ---------------------------------------------------------------------------
// Repeating tickets. Raising a ticket with "Repeat" set raises it now and
// keeps a rule; a fresh copy is then raised at 9:00 am IST on each date —
// by the same person, through the normal raise (so the Organisation chart's
// rule still applies), due as far after its date as the first one was. It
// goes on until someone stops it (the raiser, the CEO or admin), or by
// itself when the raiser can no longer raise it (they are told why).
//   daily   — every day except Sundays and company holidays
//   weekly  — the same weekday
//   monthly — the same date; months without it are skipped (the 31st)
//   yearly  — the same date; years without it are skipped (29 Feb)
// ---------------------------------------------------------------------------

const IST_MIN = 330;
const RAISE_AT_MIN = 9 * 60; // 9:00 am IST
const idOf = (v) => (v ? String(v._id || v) : null);
const pad2 = (n) => String(n).padStart(2, '0');

const istDay = (date) => new Date(new Date(date).getTime() + IST_MIN * 60000).toISOString().slice(0, 10);
const istMin = (date) => {
  const d = new Date(new Date(date).getTime() + IST_MIN * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const atIst = (day, min) => new Date(Date.parse(`${day}T00:00:00Z`) + (min - IST_MIN) * 60000);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const LABEL = { daily: 'Every day (not Sundays or holidays)', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };

async function holidaySet(fromDay, toDay) {
  const list = await holidayRepository.list({ from: new Date(`${fromDay}T00:00:00Z`), to: new Date(`${toDay}T00:00:00Z`) });
  return new Set(list.filter((h) => h.type === 'holiday').map((h) => h.date.toISOString().slice(0, 10)));
}

// The first date after `day` that the repeat lands on.
async function nextDayAfter(day, repeat, anchorDay) {
  if (repeat === TICKET_REPEAT.DAILY) {
    const holidays = await holidaySet(addDays(day, 1), addDays(day, 60));
    let d = addDays(day, 1);
    while (new Date(`${d}T00:00:00Z`).getUTCDay() === 0 || holidays.has(d)) d = addDays(d, 1);
    return d;
  }
  if (repeat === TICKET_REPEAT.WEEKLY) return addDays(day, 7);
  const [, , dom] = anchorDay.split('-').map(Number);
  const [, am] = anchorDay.split('-').map(Number);
  let [y, m] = day.split('-').map(Number);
  for (let i = 0; i < 400; i += 1) {
    if (repeat === TICKET_REPEAT.MONTHLY) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    } else {
      y += 1;
      m = am;
    }
    if (dom <= daysInMonth(y, m)) return `${y}-${pad2(m)}-${pad2(dom)}`;
  }
  throw new Error('No next date found');
}

// Starts a repeat for a ticket just raised (from the raise request itself).
async function start(user, input, ticketView) {
  const { repeat, ...rest } = input;
  if (!Object.values(TICKET_REPEAT).includes(repeat)) return null;
  const raisedAt = new Date(ticketView.createdAt || Date.now());
  const anchorDay = istDay(raisedAt);
  const dueAt = new Date(input.dueAt);
  const nextDay = await nextDayAfter(anchorDay, repeat, anchorDay);
  const rule = await TicketRepeat.create({
    repeat,
    raisedBy: user.id,
    // What each copy is raised with — the due date is worked out per date.
    input: { ...rest, dueAt: undefined },
    anchorDay,
    dueDays: Math.max(0, daysBetween(anchorDay, istDay(dueAt))),
    dueMin: istMin(dueAt),
    nextDay,
    nextAt: atIst(nextDay, RAISE_AT_MIN),
    lastTicket: ticketView._id,
  });
  await Ticket.updateOne({ _id: ticketView._id }, { $set: { repeat: rule._id } });
  return rule;
}

async function stopRule(rule, { by = null, reason }) {
  rule.active = false;
  rule.stoppedAt = new Date();
  rule.stoppedBy = by ? by.id : undefined;
  rule.stopReason = reason;
  await rule.save();
  const last = rule.lastTicket ? await Ticket.findById(rule.lastTicket) : null;
  if (last) {
    await ticketService.record(last, TICKET_EVENT.REPEAT_STOPPED, by, { note: reason || '', meta: { repeat: LABEL[rule.repeat], raised: rule.raisedCount } });
  }
}

// Raises the copy for every repeat whose date has come. A repeat that missed
// several dates (the server was down) raises only the latest one. Each rule
// is claimed before raising, so two servers on the same database never both
// raise the same date.
async function runDue(now = new Date()) {
  const due = await TicketRepeat.find({ active: true, nextAt: { $lte: now } });
  let raised = 0;
  for (const rule of due) {
    try {
      // The latest date that has come.
      let day = rule.nextDay;
      // eslint-disable-next-line no-await-in-loop
      for (let next = await nextDayAfter(day, rule.repeat, rule.anchorDay); atIst(next, RAISE_AT_MIN) <= now; next = await nextDayAfter(day, rule.repeat, rule.anchorDay)) day = next;
      // eslint-disable-next-line no-await-in-loop
      const following = await nextDayAfter(day, rule.repeat, rule.anchorDay);
      // eslint-disable-next-line no-await-in-loop
      const claimed = await TicketRepeat.findOneAndUpdate(
        { _id: rule._id, active: true, nextAt: rule.nextAt },
        { $set: { nextDay: following, nextAt: atIst(following, RAISE_AT_MIN) } },
        { new: true }
      );
      if (!claimed) continue;

      // eslint-disable-next-line no-await-in-loop
      const user = await accessService.resolveUser(idOf(rule.raisedBy));
      if (!user) {
        // eslint-disable-next-line no-await-in-loop
        await stopRule(claimed, { reason: 'The person who raised it no longer has an active login' });
        continue;
      }
      const dueAt = atIst(addDays(day, claimed.dueDays), claimed.dueMin);
      let ticket;
      try {
        // eslint-disable-next-line no-await-in-loop
        ticket = await ticketService.raise(user, { ...claimed.input, dueAt }, { repeatId: claimed._id, repeatLabel: LABEL[claimed.repeat] });
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        // The chart changed (they can't raise for these people any more), a
        // person left, a team went… — stop, and tell the raiser why.
        // eslint-disable-next-line no-await-in-loop
        await stopRule(claimed, { reason: `Stopped by itself: ${err.message}` });
        // eslint-disable-next-line no-await-in-loop
        await notificationService.createForUsers([rule.raisedBy], {
          type: NOTIFICATION_TYPES.TICKET_REPEAT_STOPPED,
          title: `Repeating ticket stopped — ${claimed.input.title}`,
          message: `"${claimed.input.title}" could not be raised for ${day}, so it no longer repeats: ${err.message}`,
          ticket: claimed.lastTicket,
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await TicketRepeat.updateOne({ _id: claimed._id }, { $set: { lastTicket: ticket._id }, $inc: { raisedCount: 1 } });
      raised += 1;
    } catch (err) {
      logger.error({ err, repeat: idOf(rule._id) }, 'Could not raise a repeating ticket');
    }
  }
  return raised;
}

// Stopping: the person who set it up, the CEO or admin.
async function stop(user, id, { reason } = {}) {
  const rule = await TicketRepeat.findById(id);
  if (!rule) throw ApiError.notFound('Repeat not found');
  if (!rule.active) throw ApiError.conflict('This ticket has already stopped repeating');
  if (idOf(rule.raisedBy) !== idOf(user.id) && !ticketService.seesEveryone(user)) {
    throw ApiError.forbidden('Only the person who set it up, the CEO or admin can stop it');
  }
  await stopRule(rule, { by: user, reason: reason?.trim() || 'Stopped' });
  return { stopped: true };
}

module.exports = { start, runDue, stop, nextDayAfter, LABEL };
