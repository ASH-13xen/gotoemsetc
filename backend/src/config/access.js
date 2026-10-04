const { USER_ROLES: R } = require('./constants');

// ---------------------------------------------------------------------------
// WHO MAY DO WHAT — the single source of truth for every access check.
//
// A person's roles = their own login's role + the role of every post they
// hold in the Organisation chart (OrgNode.grantsRole). Their access is the
// union of what each of those roles grants below. Admin can never be
// granted by a post — only the admin login has it.
//
// Every route gate and service check asks "can this person do X?" with one
// of these keys (see utils/roles.js#can). Nothing compares a single
// `role` string any more.
// ---------------------------------------------------------------------------

const ACCESS = {
  // Every employee's EMS record — see, edit, add, credentials, documents,
  // applicants, attendance marking, per-employee salary slips. Implies every
  // grantable EMS permission (PERMISSIONS in constants.js).
  EMS_ALL: 'ems_all',
  // HR Work (HRMS) — bulk tools, leave approvals, attendance warnings,
  // holidays, company events, client/brand dates.
  HRMS: 'hrms',
  // Change attendance of any age (HR alone is limited to the last 2 days).
  ATTENDANCE_NO_TIME_LIMIT: 'attendance_no_time_limit',
  // Final say: unpaid leave's CEO stage, and HR's change requests for
  // attendance older than 2 days.
  ATTENDANCE_FINAL_APPROVAL: 'attendance_final_approval',
  // Operations tab — complaint register.
  OPERATIONS: 'operations',
  // Reassign office keys (everyone else can only view them).
  OFFICE_KEYS_EDIT: 'office_keys_edit',
  // Finance tab — salary payouts, F&F, invoices, monthly bills, reimbursements.
  FINANCE: 'finance',
  // Approving inside Finance — invoices, plan prices, bill templates.
  FINANCE_APPROVE: 'finance_approve',
  // Performance flags — giving/removing them and the history page.
  PERFORMANCE_FLAGS: 'performance_flags',
  // Event Management page.
  EVENTS: 'events',
  // Sending announcements.
  ANNOUNCEMENTS_CREATE: 'announcements_create',
  AUDIT_LOG: 'audit_log',
  ORG_CHART_EDIT: 'org_chart_edit',
  // Weekly Calendar: see the titles of everyone's personal blocks.
  CALENDAR_SEE_ALL: 'calendar_see_all',
  // Attaching a document to an employee directly (no request link).
  DIRECT_DOCUMENT_UPLOAD: 'direct_document_upload',
};

const GRANTS = {
  [ACCESS.EMS_ALL]: [R.ADMIN, R.CEO, R.HR],
  [ACCESS.HRMS]: [R.ADMIN, R.CEO, R.HR],
  [ACCESS.ATTENDANCE_NO_TIME_LIMIT]: [R.ADMIN, R.CEO],
  [ACCESS.ATTENDANCE_FINAL_APPROVAL]: [R.ADMIN, R.CEO],
  [ACCESS.OPERATIONS]: [R.ADMIN, R.CEO, R.OPERATIONS_MANAGER],
  [ACCESS.OFFICE_KEYS_EDIT]: [R.ADMIN, R.CEO, R.OPERATIONS_MANAGER],
  [ACCESS.FINANCE]: [R.ADMIN, R.CFO, R.FINANCE],
  [ACCESS.FINANCE_APPROVE]: [R.ADMIN, R.CFO],
  [ACCESS.PERFORMANCE_FLAGS]: [R.ADMIN, R.CEO],
  [ACCESS.EVENTS]: [R.ADMIN, R.CEO, R.HR],
  [ACCESS.ANNOUNCEMENTS_CREATE]: [R.ADMIN, R.CEO, R.CTO, R.CFO, R.HR, R.TEAM_LEAD, R.OPERATIONS_MANAGER, R.SALES],
  [ACCESS.AUDIT_LOG]: [R.ADMIN],
  [ACCESS.ORG_CHART_EDIT]: [R.ADMIN],
  [ACCESS.CALENDAR_SEE_ALL]: [R.ADMIN],
  [ACCESS.DIRECT_DOCUMENT_UPLOAD]: [R.ADMIN],
};

// Roles a post in the Organisation chart may give. Never admin, never
// worker (everyone is a worker already).
const GRANTABLE_ROLES = [R.CEO, R.CTO, R.CFO, R.HR, R.OPERATIONS_MANAGER, R.SALES, R.TECHNICAL, R.TEAM_LEAD, R.DIGITAL_ADMIN, R.FINANCE];

// Seniority — when one person acts with access several of their roles
// share, the most senior one is recorded as the role they acted in.
const ROLE_RANK = {
  [R.ADMIN]: 100,
  [R.CEO]: 90,
  [R.CTO]: 80,
  [R.CFO]: 80,
  [R.HR]: 70,
  [R.OPERATIONS_MANAGER]: 60,
  [R.FINANCE]: 55,
  [R.TEAM_LEAD]: 50,
  [R.SALES]: 45,
  [R.TECHNICAL]: 45,
  [R.DIGITAL_ADMIN]: 45,
  [R.WORKER]: 0,
};

const ROLE_LABEL = {
  [R.ADMIN]: 'Admin',
  [R.CEO]: 'CEO',
  [R.CTO]: 'CTO',
  [R.CFO]: 'CFO',
  [R.HR]: 'HR',
  [R.OPERATIONS_MANAGER]: 'Operations',
  [R.FINANCE]: 'Finance',
  [R.TEAM_LEAD]: 'Team Lead',
  [R.SALES]: 'Sales',
  [R.TECHNICAL]: 'Technical',
  [R.DIGITAL_ADMIN]: 'Digital Admin',
  [R.WORKER]: 'Employee',
};

function accessForRoles(roles) {
  const set = new Set(roles);
  return Object.entries(GRANTS)
    .filter(([, granted]) => granted.some((r) => set.has(r)))
    .map(([key]) => key);
}

module.exports = { ACCESS, GRANTS, GRANTABLE_ROLES, ROLE_RANK, ROLE_LABEL, accessForRoles };
