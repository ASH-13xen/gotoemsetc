const cron = require('node-cron');
const reimbursementRepository = require('../repositories/reimbursement.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('../services/notification.service');
const reimbursementService = require('../services/reimbursement.service');
const { NOTIFICATION_TYPES } = require('../config/constants');
const logger = require('../utils/logger');

// Reimbursements for a Monday-to-Sunday week are paid on the Monday after
// it. Every Monday morning Finance is reminded of the approved claims (the
// CEO's approval included) whose week has closed.
async function remindPendingPayouts(now = new Date()) {
  const thisMonday = reimbursementService.weekMondayStart(now);
  const pending = (await reimbursementRepository.listApprovedUnpaid()).filter((r) => new Date(r.expenseDate).getTime() < thisMonday.getTime());
  if (pending.length === 0) return;

  const financeTeam = await userRepository.findFinanceTeam();
  const recipientIds = [...new Set(financeTeam.map((u) => u._id.toString()))];
  if (recipientIds.length === 0) return;

  const total = pending.reduce((sum, r) => sum + (r.amount || 0), 0);
  await notificationService.createForUsers(recipientIds, {
    type: NOTIFICATION_TYPES.REIMBURSEMENT_PAYMENT_REMINDER,
    title: 'Reimbursements ready to pay',
    message: `${pending.length} approved reimbursement${pending.length === 1 ? '' : 's'} (₹${total.toLocaleString('en-IN')} total) from last week ${pending.length === 1 ? 'is' : 'are'} ready to be paid today.`,
  });
  logger.info({ count: pending.length }, 'Sent Monday reimbursement payment reminder');
}

function start() {
  cron.schedule(
    '0 9 * * 1',
    () => {
      remindPendingPayouts().catch((err) => logger.error({ err }, 'Reimbursement payment reminder job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, remindPendingPayouts };
