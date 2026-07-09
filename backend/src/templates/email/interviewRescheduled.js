const { emailLayout } = require('./layout');
const { formatDateTime } = require('./interviewScheduled');

function interviewRescheduledEmail({ applicant, scheduledAt }) {
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
  const when = formatDateTime(scheduledAt);

  const bodyHtml = `
    <p>Hi ${name},</p>
    <p>Your interview for the <strong>${applicant.positionAppliedFor || 'position'}</strong> role has been <strong>rescheduled</strong>. Please note the new date and time below.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e4e4e7;border-radius:6px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">New interview time</p>
          <p style="margin:0;font-size:16px;font-weight:bold;">${when}</p>
        </td>
      </tr>
    </table>
    <p>We apologize for any inconvenience this change may cause. If you have any questions or this new time doesn't work, reply to the WhatsApp number you applied through.</p>
    <p>We look forward to speaking with you then.</p>
  `;

  return {
    subject: `Interview rescheduled — ${applicant.positionAppliedFor || 'your application'}`,
    html: emailLayout({ preheader: `Your interview has been rescheduled to ${when}`, bodyHtml, accentColor: '#92400e' }),
  };
}

module.exports = { interviewRescheduledEmail };
