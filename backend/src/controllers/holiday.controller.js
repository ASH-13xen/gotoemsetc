const asyncHandler = require('../utils/asyncHandler');
const holidayService = require('../services/holiday.service');

const list = asyncHandler(async (req, res) => {
  const holidays = await holidayService.listHolidays(req.query);
  res.json({ holidays });
});

const create = asyncHandler(async (req, res) => {
  const holiday = await holidayService.createHoliday(req.body, req.user.id);
  req.auditContext = {
    action: 'holiday.create',
    resourceType: 'Holiday',
    resourceId: holiday._id,
    metadata: { date: req.body.date, label: req.body.label },
  };
  res.status(201).json({ holiday });
});

const remove = asyncHandler(async (req, res) => {
  await holidayService.removeHoliday(req.params.id);
  req.auditContext = { action: 'holiday.delete', resourceType: 'Holiday', resourceId: req.params.id };
  res.status(204).send();
});

module.exports = { list, create, remove };
