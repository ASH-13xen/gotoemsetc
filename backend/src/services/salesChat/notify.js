const userRepository = require('../../repositories/user.repository');
const notificationService = require('../notification.service');
const emailService = require('../email.service');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { NOTIFICATION_TYPES, SALES_ROUTING_DESTINATION } = require('../../config/constants');

// Fires the moment a sales lead needs a human — a bot-decided handoff, a
// meeting offer, the "talk to a human" button, or the plain fallback form.
// Without this, a fully-qualified lead sits in Mongo with nobody ever told
// it exists (see the "once chat is done" gap this closes).
//
// Best-effort throughout, same convention as notification.service.js and
// cmsNotify.service.js — a notification failure must never break the chat
// turn, the handoff click, or the form submission that triggered it.
async function notifyTeam(lead, { reason } = {}) {
  try {
    const recipients = await userRepository.findAdmins();
    if (lead.routingDestination === SALES_ROUTING_DESTINATION.CEO_TRACK) {
      recipients.push(...(await userRepository.findCeos()));
    }
    const userIds = [...new Set(recipients.map((u) => u._id.toString()))];

    const contact = [lead.email, lead.phone].filter(Boolean).join(' / ') || 'no contact on file yet';
    const title = `New sales lead — ${lead.name || lead.company || 'unnamed visitor'} (${lead.scoreBand} · ${lead.score})`;
    const reasonText = (reason || lead.routingReason || 'Needs a human.').trim().replace(/[.!]$/, '');
    const message = `${reasonText}. Contact: ${contact}.`;

    if (userIds.length) {
      await notificationService.createForUsers(userIds, {
        type: NOTIFICATION_TYPES.SALES_LEAD_ROUTED,
        title,
        message,
        salesLead: lead._id,
      });
    }

    if (env.salesLeadNotificationEmail) {
      const q = lead.qualification || {};
      await emailService.sendEmail({
        to: env.salesLeadNotificationEmail,
        subject: title,
        html: `
          <p>${message}</p>
          <ul>
            <li><strong>Name:</strong> ${lead.name || '—'}</li>
            <li><strong>Company:</strong> ${lead.company || '—'}</li>
            <li><strong>Industry:</strong> ${lead.industry || '—'}</li>
            <li><strong>Email:</strong> ${lead.email || '—'}</li>
            <li><strong>Phone:</strong> ${lead.phone || '—'}</li>
            <li><strong>Score:</strong> ${lead.score} (${lead.scoreBand})</li>
            <li><strong>Routing:</strong> ${lead.routingDestination || '—'}</li>
            <li><strong>Primary goal:</strong> ${q.primaryGoal || '—'}</li>
            <li><strong>Budget:</strong> ${q.budgetBand || '—'}</li>
            <li><strong>Timeline:</strong> ${q.timeline || '—'}</li>
          </ul>
        `,
      });
    }
  } catch (err) {
    logger.error({ err, leadId: lead._id }, 'salesChat: failed to notify team of routed lead');
  }
}

module.exports = { notifyTeam };
