const asyncHandler = require('../utils/asyncHandler');
const companyEventService = require('../services/companyEvent.service');

const list = asyncHandler(async (req, res) => {
  const events = await companyEventService.listForMonth(req.query.month);
  res.json({ events });
});

const create = asyncHandler(async (req, res) => {
  const event = await companyEventService.createEvent(req.body, req.user.id);
  req.auditContext = {
    action: 'companyEvent.create',
    resourceType: 'CompanyEvent',
    resourceId: event._id,
    metadata: { type: req.body.type, name: req.body.name, date: req.body.date },
  };
  res.status(201).json({ event });
});

const remove = asyncHandler(async (req, res) => {
  await companyEventService.removeEvent(req.params.id);
  req.auditContext = { action: 'companyEvent.delete', resourceType: 'CompanyEvent', resourceId: req.params.id };
  res.status(204).send();
});

module.exports = { list, create, remove };
