const User = require('../models/User');
const { USER_ROLES } = require('../config/constants');

function findByUsername(username) {
  return User.findOne({ username: username.toLowerCase(), isActive: true }).select('+passwordHash');
}

function findById(id) {
  return User.findOne({ _id: id, isActive: true });
}

// No isActive filter — the admin needs to see a revoked credential too
// (to know one exists and re-activate/replace it), not just active logins.
function findByEmployeeId(employeeId) {
  return User.findOne({ employeeLink: employeeId });
}

function findByIdAny(id) {
  return User.findById(id);
}

function create(data) {
  return User.create(data);
}

function updateById(id, data) {
  return User.findByIdAndUpdate(id, data, { new: true });
}

function list() {
  return User.find({ isActive: true }).sort({ username: 1 });
}

function findAdmins() {
  return User.find({ role: USER_ROLES.ADMIN, isActive: true });
}

// Attendance modification requests route to HR specifically (not admin) —
// see attendanceRequest.service.js#createRequest.
function findHr() {
  return User.find({ role: USER_ROLES.HR, isActive: true });
}

// A filed complaint notifies admins plus whoever holds the operations_manager
// role — see complaint.service.js#fileComplaint. Deliberately not CEO: the
// image spec calls out "operational manager & admin" specifically, even
// though CEO separately has full view/act access to the Operations module.
function findOperationsManagers() {
  return User.find({ role: USER_ROLES.OPERATIONS_MANAGER, isActive: true });
}

// The company-wide Team Leader — any account holding the team_lead login
// role, not tied to any one WorkTeam. Used to notify whoever's responsible
// for the "lead" step of a client pipeline — see cmsNotify.service.js.
function findTeamLeads() {
  return User.find({ role: USER_ROLES.TEAM_LEAD, isActive: true });
}

// Digital Admin + CEO + the global Team Leader — company-wide oversight of
// Client Management, independent of any one client's team. Used to notify
// about client-scoped events/meetings alongside whoever's actually on that
// client's team (see companyEvent's client-scoped reminders and the
// Meetings/MOM feature).
function findCmsOversightUsers() {
  return User.find({
    role: { $in: [USER_ROLES.DIGITAL_ADMIN, USER_ROLES.CEO, USER_ROLES.TEAM_LEAD] },
    isActive: true,
  });
}

// The Finance module's own oversight set — admin/ceo/account_manager, same
// three roles requireFinanceAccess() (auth.middleware.js) gates writes to.
// Used to notify about salary/FnF/invoice/reimbursement events that aren't
// scoped to one specific already-known recipient.
function findFinanceUsers() {
  return User.find({
    role: { $in: [USER_ROLES.ADMIN, USER_ROLES.CEO, USER_ROLES.ACCOUNT_MANAGER] },
    isActive: true,
  });
}

// Monthly Bills' base reminder audience (see jobs/monthlyBillCycle.job.js) —
// deliberately just this one role, not findFinanceUsers (which also pulls in
// admin/ceo): the spec has ceo joining only inside the 1-day escalation, and
// admin isn't part of the reminder audience at all.
function findAccountManagers() {
  return User.find({ role: USER_ROLES.ACCOUNT_MANAGER, isActive: true });
}

// Who signs off on an auto-generated invoice before it goes to the client —
// admin/ceo only, narrower than findFinanceUsers (account_manager tracks and
// collects payment but doesn't approve). See invoice.service.js.
function findInvoiceApprovers() {
  return User.find({ role: { $in: [USER_ROLES.ADMIN, USER_ROLES.CEO] }, isActive: true });
}

// Reimbursement approval is CEO-only per spec — see reimbursement.service.js.
function findCeos() {
  return User.find({ role: USER_ROLES.CEO, isActive: true });
}

module.exports = {
  findByUsername,
  findById,
  findByEmployeeId,
  findByIdAny,
  create,
  updateById,
  list,
  findAdmins,
  findHr,
  findOperationsManagers,
  findTeamLeads,
  findCmsOversightUsers,
  findFinanceUsers,
  findAccountManagers,
  findInvoiceApprovers,
  findCeos,
};
