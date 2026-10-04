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

// Off-boarding/removing an employee revokes every login linked to them —
// the same soft delete (isActive: false) as deleting a credential by hand,
// so an admin can still see it, and re-activate it if someone is rehired.
function deactivateForEmployee(employeeId) {
  require('../services/access.service').invalidate();
  return User.updateMany({ employeeLink: employeeId, isActive: true }, { isActive: false });
}

// Cheap per-request check that a token's account still exists and is active.
function isActiveId(id) {
  return User.exists({ _id: id, isActive: true });
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

// Every finder below returns the role's own login(s) PLUS everyone holding
// a post that gives that role in the Organisation chart — so Juhika, as HR,
// gets HR's notifications on her own login too. See access.service.js.
const withRoles = (...roles) => require('../services/access.service').findUsersWithRoles(roles);

// Attendance modification requests route to HR specifically (not admin) —
// see attendanceRequest.service.js#createRequest.
function findHr() {
  return withRoles(USER_ROLES.HR);
}

// A filed complaint notifies admins plus whoever holds the operations_manager
// role — see complaint.service.js#fileComplaint. Deliberately not CEO: the
// image spec calls out "operational manager & admin" specifically, even
// though CEO separately has full view/act access to the Operations module.
function findOperationsManagers() {
  return withRoles(USER_ROLES.OPERATIONS_MANAGER);
}

// The company-wide Team Leader — any account holding the team_lead login
// role, not tied to any one WorkTeam. Used to notify whoever's responsible
// for the "lead" step of a client pipeline — see cmsNotify.service.js.
function findTeamLeads() {
  return withRoles(USER_ROLES.TEAM_LEAD);
}

// Digital Admin + CEO + the global Team Leader — company-wide oversight of
// Client Management, independent of any one client's team. Used to notify
// about client-scoped events/meetings alongside whoever's actually on that
// client's team (see companyEvent's client-scoped reminders and the
// Meetings/MOM feature).
function findCmsOversightUsers() {
  return withRoles(USER_ROLES.DIGITAL_ADMIN, USER_ROLES.CEO, USER_ROLES.TEAM_LEAD);
}

// The Finance module's own oversight set — admin/cfo/finance, the same
// roles the Finance tab is open to (config/access.js). Used to notify about
// salary/FnF/invoice/reimbursement events that aren't scoped to one
// specific already-known recipient.
function findFinanceUsers() {
  return withRoles(USER_ROLES.ADMIN, USER_ROLES.CFO, USER_ROLES.FINANCE);
}

// Monthly Bills' base reminder audience (see jobs/monthlyBillCycle.job.js) —
// deliberately just cfo + finance, not findFinanceUsers (which also pulls in
// admin/ceo): the spec has ceo joining only inside the 1-day escalation, and
// admin isn't part of the reminder audience at all.
function findFinanceTeam() {
  return withRoles(USER_ROLES.CFO, USER_ROLES.FINANCE);
}

// Who signs off inside Finance — invoices before they go to the client,
// bill templates — admin and the CFO (config/access.js FINANCE_APPROVE).
function findInvoiceApprovers() {
  return withRoles(USER_ROLES.ADMIN, USER_ROLES.CFO);
}

function findCeos() {
  return withRoles(USER_ROLES.CEO);
}

module.exports = {
  findByUsername,
  findById,
  findByEmployeeId,
  findByIdAny,
  deactivateForEmployee,
  isActiveId,
  create,
  updateById,
  list,
  findAdmins,
  findHr,
  findOperationsManagers,
  findTeamLeads,
  findCmsOversightUsers,
  findFinanceUsers,
  findFinanceTeam,
  findInvoiceApprovers,
  findCeos,
};
