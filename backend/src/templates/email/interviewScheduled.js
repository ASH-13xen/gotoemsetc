const { emailLayout } = require('./layout');

function formatDateTime(date) {
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function interviewScheduledEmail({ applicant, scheduledAt }) {
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
  const when = formatDateTime(scheduledAt);

  const bodyHtml = `
    <p>Hi ${name},</p>
    <p>Thank you for applying for the <strong>${applicant.positionAppliedFor || 'position'}</strong> role. We'd like to invite you for an interview.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e4e4e7;border-radius:6px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Interview scheduled for</p>
          <p style="margin:0;font-size:16px;font-weight:bold;">${when}</p>
        </td>
      </tr>
    </table>
    <p>Please make sure you're available a few minutes ahead of time. If you have any questions or need to reschedule, reply to the WhatsApp number you applied through.</p>
    <p>We look forward to speaking with you.</p>
  `;

  return {
    subject: `Interview scheduled — ${applicant.positionAppliedFor || 'your application'}`,
    html: emailLayout({ preheader: `Your interview is scheduled for ${when}`, bodyHtml }),
  };
}

module.exports = { interviewScheduledEmail, formatDateTime };
