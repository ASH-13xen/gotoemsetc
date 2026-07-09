const asyncHandler = require('../utils/asyncHandler');
const applicantService = require('../services/applicant.service');
const interviewService = require('../services/interview.service');

const list = asyncHandler(async (req, res) => {
  const result = await applicantService.listApplicants(req.query);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const applicant = await applicantService.getApplicant(req.params.id);
  res.json(applicant);
});

const create = asyncHandler(async (req, res) => {
  const applicant = await applicantService.createApplicant(req.body, req.files || []);
  res.status(201).json({ applicant });
});

const update = asyncHandler(async (req, res) => {
  const applicant = await applicantService.updateApplicant(req.params.id, req.body);
  res.json({ applicant });
});

const remove = asyncHandler(async (req, res) => {
  await applicantService.deleteApplicant(req.params.id);
  res.status(204).send();
});

const hire = asyncHandler(async (req, res) => {
  const { applicant, employee } = await applicantService.hireApplicant(req.params.id, req.body);
  res.json({ applicant, employee });
});

const reject = asyncHandler(async (req, res) => {
  const applicant = await applicantService.rejectApplicant(req.params.id, req.body);
  res.json({ applicant });
});

const scheduleInterview = asyncHandler(async (req, res) => {
  const { applicant, interview } = await interviewService.scheduleInterview(
    req.params.id,
    req.body,
    req.user
  );
  res.status(201).json({ applicant, interview });
});

const cancelInterview = asyncHandler(async (req, res) => {
  const { applicant, interview } = await interviewService.cancelInterview(
    req.params.id,
    req.params.interviewId
  );
  res.json({ applicant, interview });
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  hire,
  reject,
  scheduleInterview,
  cancelInterview,
};
