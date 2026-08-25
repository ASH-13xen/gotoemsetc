const asyncHandler = require('../utils/asyncHandler');
const announcementService = require('../services/announcement.service');

const create = asyncHandler(async (req, res) => {
  const announcement = await announcementService.createAnnouncement(req.body, req.user.id);
  req.auditContext = {
    action: 'announcement.create',
    resourceType: 'Announcement',
    resourceId: announcement._id,
    metadata: { title: announcement.title, recipientCount: announcement.recipients.length },
  };
  res.status(201).json({ announcement });
});

const list = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listAllAnnouncements();
  res.json({ announcements });
});

const listMinePending = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listPendingForEmployee(req.user.employeeLink);
  res.json({ announcements });
});

const acknowledge = asyncHandler(async (req, res) => {
  const announcement = await announcementService.acknowledgeAnnouncement(req.params.id, req.user.employeeLink);
  res.json({ announcement });
});

module.exports = { create, list, listMinePending, acknowledge };
