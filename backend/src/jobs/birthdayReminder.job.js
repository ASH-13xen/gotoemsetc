const cron = require('node-cron');
const { NOTIFICATION_TYPES, COMPANY_EVENT_TYPE } = require('../config/constants');
const employeeRepository = require('../repositories/employee.repository');
const companyEventRepository = require('../repositories/companyEvent.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

const COMPANY_EVENT_LABEL = {
  [COMPANY_EVENT_TYPE.CLIENT_BIRTHDAY]: 'birthday',
  [COMPANY_EVENT_TYPE.CLIENT_ANNIVERSARY]: 'anniversary',
  [COMPANY_EVENT_TYPE.BRAND_ANNIVERSARY]: 'anniversary',
};

function isMonthDay(date, month, day) {
  return date.getMonth() === month && date.getDate() === day;
}

function formatMonthDay(date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
}

// Runs once a day, checks every employee's date of birth against today and
// two days from now, and notifies every user in the system either way —
// exported (rather than only wired into node-cron) so it can be invoked
// directly for manual verification. Naturally idempotent: a birthday's
// month/day only matches "today" or "in two days" on one specific calendar
// day each, so a single daily run per employee never double-fires within
// the same year.
async function sendDueBirthdayNotifications() {
  const employees = await employeeRepository.listAllWithDob();
  if (!employees.length) return;

  const users = await userRepository.list();
  const recipientIds = users.map((u) => u._id);
  if (!recipientIds.length) return;

  const today = new Date();
  const inTwoDays = new Date(today);
  inTwoDays.setDate(inTwoDays.getDate() + 2);

  let sent = 0;
  for (const employee of employees) {
    const dob = new Date(employee.dob);
    const name = `${employee.firstName} ${employee.lastName || ''}`.trim();

    if (isMonthDay(dob, today.getMonth(), today.getDate())) {
      await notificationService.createForUsers(recipientIds, {
        type: NOTIFICATION_TYPES.BIRTHDAY_TODAY,
        title: 'Birthday today',
        message: `It's ${name}'s birthday today — wish them well!`,
        employee: employee._id,
      });
      sent += 1;
    } else if (isMonthDay(dob, inTwoDays.getMonth(), inTwoDays.getDate())) {
      await notificationService.createForUsers(recipientIds, {
        type: NOTIFICATION_TYPES.BIRTHDAY_UPCOMING,
        title: 'Upcoming birthday',
        message: `${name}'s birthday is coming up on ${formatMonthDay(dob)}.`,
        employee: employee._id,
      });
      sent += 1;
    }
  }

  if (sent) logger.info({ count: sent }, 'Sent birthday notifications');
}

// Same "today or in two days" pattern as sendDueBirthdayNotifications above,
// just sourced from CompanyEvent (client birthdays/anniversaries, brand
// anniversary) instead of Employee.dob — manually entered rather than
// derived, but notified identically.
async function sendDueCompanyEventNotifications() {
  const events = await companyEventRepository.list();
  if (!events.length) return;

  const users = await userRepository.list();
  const recipientIds = users.map((u) => u._id);
  if (!recipientIds.length) return;

  const today = new Date();
  const inTwoDays = new Date(today);
  inTwoDays.setDate(inTwoDays.getDate() + 2);

  let sent = 0;
  for (const event of events) {
    const date = new Date(event.date);
    const label = COMPANY_EVENT_LABEL[event.type] || 'event';

    if (isMonthDay(date, today.getMonth(), today.getDate())) {
      await notificationService.createForUsers(recipientIds, {
        type: NOTIFICATION_TYPES.COMPANY_EVENT_TODAY,
        title: `${label === 'birthday' ? 'Birthday' : 'Anniversary'} today`,
        message: `It's ${event.name}'s ${label} today${event.notes ? ` — ${event.notes}` : ''}.`,
      });
      sent += 1;
    } else if (isMonthDay(date, inTwoDays.getMonth(), inTwoDays.getDate())) {
      await notificationService.createForUsers(recipientIds, {
        type: NOTIFICATION_TYPES.COMPANY_EVENT_UPCOMING,
        title: `Upcoming ${label}`,
        message: `${event.name}'s ${label} is coming up on ${formatMonthDay(date)}.`,
      });
      sent += 1;
    }
  }

  if (sent) logger.info({ count: sent }, 'Sent company event notifications');
}

// 2pm IST, daily — same time as the interview reminder job, pinned to
// Asia/Kolkata explicitly rather than relying on the server's local time
// (Render runs in UTC).
function start() {
  cron.schedule(
    '0 14 * * *',
    () => {
      sendDueBirthdayNotifications().catch((err) => logger.error({ err }, 'Birthday reminder job failed'));
      sendDueCompanyEventNotifications().catch((err) => logger.error({ err }, 'Company event reminder job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, sendDueBirthdayNotifications, sendDueCompanyEventNotifications };
