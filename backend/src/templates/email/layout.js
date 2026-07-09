const env = require('../../config/env');

// Shared table-based layout so these render consistently across email
// clients (Outlook in particular ignores modern CSS) — plain inline styles
// only, no flexbox/grid.
function emailLayout({ preheader = '', bodyHtml, accentColor = '#111827' }) {
  const company = env.companyName;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${company}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background-color:${accentColor};padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">${company}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#27272a;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;">
                This is an automated message from ${company}'s recruitment team. Please do not reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = { emailLayout };
