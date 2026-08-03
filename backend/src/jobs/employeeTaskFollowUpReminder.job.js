const cron = require('node-cron');
const employeeTaskRepository = require('../repositories/employeeTask.repository');
const employeeRepository = require('../repositories/employee.repository');
const employeeTaskNotify = require('../services/employeeTaskNotify.service');
const employeeTaskService = require('../services/employeeTask.service');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

async function sendFollowUpReminderEmails(task, followUp) {
  const employeeIds = [...new Set(employeeTaskNotify.taskAssigneeEmployeeIds(task).map((v) => (v._id || v).toString()))];
  const employees = await Promise.all(employeeIds.map((id) => employeeRepository.findById(id)));
  const recipients = employees.filter((e) => e?.personalEmail);

  const html = (employee) => `<p>Hi ${employee.firstName},</p>
<p>This is a reminder for a follow-up scheduled on "<strong>${task.title}</strong>":</p>
${followUp.note ? `<p>${followUp.note}</p>` : ''}
<p><strong>Scheduled for:</strong> ${new Date(followUp.followUpAt).toLocaleString('en-IN')}</p>
<p>Thanks,<br/>Task Manager</p>`;

  await Promise.all(
    recipients.map((employee) =>
      emailService
        .sendEmail({
          to: employee.personalEmail,
          subject: `Follow-up reminder — ${task.title}`,
          html: html(employee),
          from: employeeTaskService.taskManagerFrom(),
        })
        .catch((err) => logger.error({ err, taskId: task._id }, 'Follow-up reminder email failed'))
    )
  );
}

// Runs every 15 minutes for every EmployeeTask with a followUp that's come
// due and hasn't been reminded yet — notifies (in-app) and emails every
// current assignee, then stamps reminderSentAt so it never re-sends.
// Exported (rather than only wired into node-cron) so it can be invoked
// directly in tests/manual verification, same convention as
// interviewReminder.job.js.
async function sendDueReminders() {
  const now = new Date();
  const tasksWithDue = await employeeTaskRepository.findWithDueFollowUps(now);
  if (!tasksWithDue.length) return;

  let sentCount = 0;
  for (const task of tasksWithDue) {
    const dueFollowUps = task.followUps.filter((f) => f.followUpAt <= now && !f.reminderSentAt);
    for (const followUp of dueFollowUps) {
      try {
        await employeeTaskNotify.notifyFollowUpDue(task, followUp);
        await sendFollowUpReminderEmails(task, followUp);
        await employeeTaskRepository.updateFollowUpById(task._id, followUp._id, { reminderSentAt: now });
        sentCount += 1;
      } catch (err) {
        logger.error({ err, taskId: task._id, followUpId: followUp._id }, 'Follow-up reminder failed');
      }
    }
  }

  if (sentCount) logger.info({ count: sentCount }, 'Sent employee task follow-up reminders');
}

function start() {
  cron.schedule(
    '*/15 * * * *',
    () => {
      sendDueReminders().catch((err) => logger.error({ err }, 'Employee task follow-up reminder job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, sendDueReminders };
