const { emailLayout } = require('./layout');

function applicantRejectedEmail({ applicant, rejectionReason }) {
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim();

  const bodyHtml = `
    <p>Hi ${name},</p>
    <p>Thank you for taking the time to apply for the <strong>${applicant.positionAppliedFor || 'position'}</strong> role and for interviewing with us.</p>
    <p>After careful consideration, we've decided not to move forward with your application at this time.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e4e4e7;border-radius:6px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Feedback</p>
          <p style="margin:0;font-size:15px;">${rejectionReason}</p>
        </td>
      </tr>
    </table>
    <p>We appreciate your interest and encourage you to apply again for future openings that match your profile. We wish you the very best in your job search.</p>
  `;

  return {
    subject: `Update on your application — ${applicant.positionAppliedFor || 'your application'}`,
    html: emailLayout({ preheader: 'An update on your application', bodyHtml, accentColor: '#7f1d1d' }),
  };
}

module.exports = { applicantRejectedEmail };
