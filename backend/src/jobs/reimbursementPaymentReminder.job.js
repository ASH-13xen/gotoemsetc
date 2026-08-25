const cron = require('node-cron');
const reimbursementRepository = require('../repositories/reimbursement.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('../services/notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');
const logger = require('../utils/logger');

// Every Saturday, 09:00 IST — the weekly payment batch reminder. Every
// approved-but-unpaid reimbursement is paid on Saturdays (see
// reimbursement.service.js#assertClaimWindow for the matching claim-window
// rule); this just nudges CEO + account_manager to actually do it, whatever
// its expenseDate — payment batches by approval state, not by which week the
// expense itself falls in.
async function remindPendingPayouts() {
  const pending = await reimbursementRepository.listApprovedUnpaid();
  if (pending.length === 0) return;

  const [ceoUsers, accountManagers] = await Promise.all([
    userRepository.findCeos(),
    userRepository.findAccountManagers(),
  ]);
  const recipientIds = [...new Set([...ceoUsers, ...accountManagers].map((u) => u._id.toString()))];
  if (recipientIds.length === 0) return;

  const total = pending.reduce((sum, r) => sum + (r.amount || 0), 0);
  await notificationService.createForUsers(recipientIds, {
    type: NOTIFICATION_TYPES.REIMBURSEMENT_PAYMENT_REMINDER,
    title: 'Reimbursements ready to pay',
    message: `${pending.length} approved reimbursement${pending.length === 1 ? '' : 's'} (₹${total.toLocaleString('en-IN')} total) are ready to be paid today.`,
  });
  logger.info({ count: pending.length }, 'Sent Saturday reimbursement payment reminder');
}

function start() {
  cron.schedule(
    '0 9 * * 6',
    () => {
      remindPendingPayouts().catch((err) => logger.error({ err }, 'Reimbursement payment reminder job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, remindPendingPayouts };
