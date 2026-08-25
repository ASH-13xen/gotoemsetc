const cron = require('node-cron');
const monthlyBillRepository = require('../repositories/monthlyBill.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('../services/notification.service');
const { istInstant, istParts, istDaysInMonth } = require('../utils/istDate');
const { NOTIFICATION_TYPES, MONTHLY_BILL_INSTANCE_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 1st of every month, 00:00 IST — pushes this month's instance for every
// active bill, unless one already exists for {year, month}. dueDay is
// clamped to the month's actual last day (e.g. a dueDay of 31 lands on the
// 28th/29th in February).
async function spawnMonthlyInstances() {
  const now = new Date();
  const { year, month } = istParts(now);
  const bills = await monthlyBillRepository.listActive();

  let spawned = 0;
  for (const bill of bills) {
    const exists = bill.instances.some((i) => i.year === year && i.month === month);
    if (exists) continue;

    const day = Math.min(bill.dueDay, istDaysInMonth(year, month));
    await monthlyBillRepository.addInstance(bill._id, { year, month, dueDate: istInstant(year, month, day) });
    spawned += 1;
  }
  if (spawned) logger.info({ count: spawned }, 'Spawned monthly bill instances');
}

// Daily, 09:00 IST. No dedup guard — deliberately fires a fresh unread
// notification every day a `due` instance is within 5 days of (or past) its
// due date, which is what makes the dashboard's non-dismissible
// PendingWarningsModal-style reminder reappear daily until paid, exactly per
// spec ("asking them to pay the bills each day if not paid").
async function sendDueReminders() {
  const bills = await monthlyBillRepository.listActive();
  const now = new Date();

  // Base audience is just account_manager + operations_manager — ceo joins
  // only inside the 1-day escalation below, and admin isn't part of this
  // reminder audience at all (see findAccountManagers's comment).
  const [accountManagers, opsUsers, ceoUsers] = await Promise.all([
    userRepository.findAccountManagers(),
    userRepository.findOperationsManagers(),
    userRepository.findCeos(),
  ]);
  const baseRecipientIds = [...new Set([...accountManagers, ...opsUsers].map((u) => u._id.toString()))];
  const ceoRecipientIds = ceoUsers.map((u) => u._id.toString());

  let sent = 0;
  for (const bill of bills) {
    for (const instance of bill.instances) {
      if (instance.status !== MONTHLY_BILL_INSTANCE_STATUS.DUE) continue;
      const daysUntilDue = (instance.dueDate.getTime() - now.getTime()) / MS_PER_DAY;
      if (daysUntilDue > 5) continue;

      const overdue = daysUntilDue < 0;
      const dueDateLabel = instance.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' });
      const message = overdue
        ? `${bill.name} (₹${bill.amount.toLocaleString('en-IN')}) was due on ${dueDateLabel} and is still unpaid.`
        : `${bill.name} (₹${bill.amount.toLocaleString('en-IN')}) is due on ${dueDateLabel}.`;

      const recipientIds = daysUntilDue <= 1 ? [...new Set([...baseRecipientIds, ...ceoRecipientIds])] : baseRecipientIds;
      if (recipientIds.length === 0) continue;

      await notificationService.createForUsers(recipientIds, {
        type: NOTIFICATION_TYPES.MONTHLY_BILL_DUE_REMINDER,
        title: overdue ? 'Bill overdue' : 'Bill due soon',
        message,
        monthlyBill: bill._id,
      });
      sent += 1;
    }
  }
  if (sent) logger.info({ count: sent }, 'Sent monthly bill due reminders');
}

function start() {
  cron.schedule(
    '0 0 1 * *',
    () => {
      spawnMonthlyInstances().catch((err) => logger.error({ err }, 'Monthly bill instance spawn failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
  cron.schedule(
    '0 9 * * *',
    () => {
      sendDueReminders().catch((err) => logger.error({ err }, 'Monthly bill reminder job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, spawnMonthlyInstances, sendDueReminders };
