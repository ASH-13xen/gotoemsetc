const { emailLayout } = require('./layout');

function formatDateOnly(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    dateStyle: 'full',
    timeZone: 'Asia/Kolkata',
  });
}

function applicantHiredEmail({ applicant, startDate, selectionNotes }) {
  const name = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
  const when = formatDateOnly(startDate);

  const bodyHtml = `
    <p>Hi ${name},</p>
    <p>Congratulations! We're delighted to offer you the position of <strong>${applicant.positionAppliedFor || 'the role you applied for'}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e4e4e7;border-radius:6px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Your start date</p>
          <p style="margin:0;font-size:16px;font-weight:bold;">${when}</p>
        </td>
      </tr>
    </table>
    ${
      selectionNotes
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border:1px solid #e4e4e7;border-radius:6px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Why we chose you</p>
          <p style="margin:0;font-size:15px;">${selectionNotes}</p>
        </td>
      </tr>
    </table>`
        : ''
    }
    <p>Our team will be in touch shortly with onboarding details and paperwork. Welcome aboard — we're excited to have you with us!</p>
  `;

  return {
    subject: `You're hired! Welcome to the team`,
    html: emailLayout({ preheader: 'Congratulations on your new role', bodyHtml, accentColor: '#065f46' }),
  };
}

module.exports = { applicantHiredEmail, formatDateOnly };
