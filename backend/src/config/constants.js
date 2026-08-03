module.exports = {
  EMPLOYEE_STATUS: { DRAFT: 'draft', ACTIVE: 'active', OFFBOARDED: 'offboarded' },
  UPLOAD_REQUEST_STATUS: {
    PENDING: 'pending',
    PARTIALLY_FULFILLED: 'partially_fulfilled',
    FULFILLED: 'fulfilled',
    EXPIRED: 'expired',
    REVOKED: 'revoked',
  },
  GENERATED_DOCUMENT_STATUS: { COMPLETED: 'completed', FAILED: 'failed' },
  DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS: 24,
  MAX_UPLOAD_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_UPLOAD_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  ALLOWED_RESUME_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  // Short codes match how they're printed on the salary slip and the
  // attendance calendar — a Sunday still needs no status at all, but an
  // admin-marked Holiday now does (see HOLIDAY below).
  ATTENDANCE_STATUS: {
    PRESENT: 'P',
    PAID_LEAVE: 'O',
    HALF_DAY: 'H',
    LATE: 'L',
    SHORT_LEAVE: 'SL',
    WORK_FROM_HOME: 'W',
    // Auto-assigned only — see attendanceClassifier.service.js: zero valid
    // scans all day, or the first scan of the day is at/after 2pm.
    ABSENT: 'A',
    // Auto-assigned only, to every active employee, the moment an admin
    // marks a day as a company Holiday — see
    // attendanceClassifier.service.js#applyHolidayForEmployee. Any time
    // actually scanned that day becomes overtime (same whole-span
    // computation as a Sunday), not a normal working day.
    HOLIDAY: 'HL',
  },
  // Categories the daily attendance report can log a "not informed" warning
  // against. Deliberately separate from ATTENDANCE_STATUS — early departure
  // is a boolean flag on AttendanceRecord, not a status value, so it can't
  // reuse that enum. See attendanceWarning.service.js#computeDailyReport.
  ATTENDANCE_WARNING_CATEGORY: {
    LATE: 'late',
    EARLY_DEPARTURE: 'early_departure',
    HALF_DAY: 'half_day',
    SHORT_LEAVE: 'short_leave',
    ABSENT: 'absent',
  },
  // Canned messages HR/admin can pick from when logging a not-informed
  // warning, alongside free-typing their own. Adding/editing a message here
  // is a code change, not a DB migration — see attendanceWarning.routes.js.
  ATTENDANCE_WARNING_TEMPLATES: {
    late: [
      'You arrived late without informing your manager or HR in advance.',
      'This is a repeated instance of uninformed late arrival — please inform HR/your manager beforehand if you expect to be late.',
    ],
    early_departure: [
      'You left before your shift ended without informing your manager or HR in advance.',
      'Repeated uninformed early departure — please seek approval before leaving early.',
    ],
    half_day: [
      'You were marked Half Day without prior information to your manager or HR.',
      'Please inform HR in advance if you plan to work only half a day.',
    ],
    short_leave: [
      'You took a short leave without informing your manager or HR in advance.',
      'Please request short leave in advance rather than after the fact.',
    ],
    absent: [
      'You were absent without informing your manager or HR in advance.',
      'Repeated uninformed absence — please inform HR/your manager as early as possible if you cannot come in.',
    ],
  },
  APPLICANT_STATUS: {
    PENDING: 'pending',
    INTERVIEW_SCHEDULED: 'interview_scheduled',
    HIRED: 'hired',
    REJECTED: 'rejected',
  },
  APPLICANT_SOURCE: { MANUAL: 'manual', GOOGLE_FORM: 'google_form' },
  EXPERIENCE_LEVELS: ['fresher', '0-1', '1-2', '2-3', '3-4', '4+'],
  AVAILABILITY_OPTIONS: ['immediately', '15_days', '30_days', '60_days'],
  WORK_STYLE_OPTIONS: ['alone', 'team'],
  // The 18 roles listed on the recruitment Google Form — shared by the
  // manual-add dropdown and the form-answer normalizer.
  POSITION_OPTIONS: [
    'Content Writer/ Script Writing (Podcast)',
    'Content Manager',
    'Social Media Manager (Podcast)',
    'Social Media Manager (Digital Marketing)',
    'Digital Marketer',
    'Performance Marketer',
    'Videographer + Video Editor (Both)',
    'Videographer',
    'Video Editor',
    'Graphic Designer',
    'Sales Executive',
    'Social Media Manager',
    'Operation Manager',
    'Event Manager',
    'Executive Assistant',
    'Finance Executive',
    'HR Executive',
  ],
  INTERVIEW_STATUS: { SCHEDULED: 'scheduled', COMPLETED: 'completed', CANCELLED: 'cancelled' },
  MEETING_TYPE: { ONLINE: 'online', OFFLINE: 'offline' },
  BLOOD_GROUPS: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  NOTIFICATION_TYPES: {
    INTERVIEW_SCHEDULED: 'interview_scheduled',
    INTERVIEW_REMINDER: 'interview_reminder',
    BIRTHDAY_UPCOMING: 'birthday_upcoming',
    BIRTHDAY_TODAY: 'birthday_today',
    TASK_ASSIGNED: 'task_assigned',
    STEP_OVERDUE: 'step_overdue',
    CYCLE_ENDING_SOON: 'cycle_ending_soon',
    CYCLE_ROLLOVER: 'cycle_rollover',
    EVENT_RESPONSIBILITY_ASSIGNED: 'event_responsibility_assigned',
    ATTENDANCE_NO_SCAN: 'attendance_no_scan',
    ATTENDANCE_SINGLE_SCAN: 'attendance_single_scan',
    ATTENDANCE_UNCLASSIFIED: 'attendance_unclassified',
    ATTENDANCE_MODIFICATION_REQUESTED: 'attendance_modification_requested',
    // Fired whenever HR (not admin) manually marks/edits an attendance day —
    // carries HR's required reason, notified to admins for oversight. See
    // attendance.service.js#markAttendance.
    ATTENDANCE_MANUAL_EDIT: 'attendance_manual_edit',
    // Client birthday/anniversary or brand anniversary — manually entered
    // (see CompanyEvent) rather than derived from an Employee record, unlike
    // BIRTHDAY_TODAY/UPCOMING above.
    COMPANY_EVENT_TODAY: 'company_event_today',
    COMPANY_EVENT_UPCOMING: 'company_event_upcoming',
    // Employee Task Management — distinct from TASK_ASSIGNED/STEP_OVERDUE
    // above, which belong to the unrelated CMS Task/TaskCycle system.
    EMPLOYEE_TASK_ASSIGNED: 'employee_task_assigned',
    EMPLOYEE_TASK_FOR_REVIEW: 'employee_task_for_review',
    EMPLOYEE_TASK_COMPLETED: 'employee_task_completed',
    EMPLOYEE_TASK_FOLLOWUP_REMINDER: 'employee_task_followup_reminder',
    // Fired when a for_review task is sent back to pending instead of
    // approved — see employeeTask.service.js#rejectTask.
    EMPLOYEE_TASK_REJECTED: 'employee_task_rejected',
    // Sent to the employee themself when HR/admin logs a "not informed"
    // warning against them on the daily attendance report — see
    // attendanceWarning.service.js#sendWarning.
    ATTENDANCE_NOT_INFORMED_WARNING: 'attendance_not_informed_warning',
  },
  CLIENT_STATUS: { LEAD: 'lead', ONBOARDED: 'onboarded', OFFBOARDED: 'offboarded' },
  QUOTATION_STATUS: { DRAFT: 'draft', SHARED: 'shared', SIGNED: 'signed', SUPERSEDED: 'superseded' },
  DEFAULT_QUOTATION_SHARE_EXPIRY_HOURS: 24 * 14,
  // HR sits below Admin but is treated as admin-equivalent everywhere except
  // one explicit restriction (can't edit attendance older than 2 days — see
  // attendance.service.js#assertCanEditAttendanceDate). See
  // auth.middleware.js's isAdminLike for where this equivalence is applied.
  USER_ROLES: { ADMIN: 'admin', WORKER: 'worker', HR: 'hr' },
  ATTENDANCE_REQUEST_STATUS: { PENDING: 'pending', RESOLVED: 'resolved' },
  // Granular capabilities a worker credential can be individually granted
  // (via Add Credentials) on top of their base self-only access — an admin
  // always implicitly has every one of these. See auth.middleware.js's
  // requirePermission/requireSelfOrPermission for how these gate routes.
  PERMISSIONS: {
    VIEW_APPLICANTS: 'view_applicants',
    ADD_EMPLOYEE: 'add_employee',
    GENERATE_DOCUMENTS: 'generate_documents',
    REQUEST_DOCUMENTS: 'request_documents',
    ADD_CREDENTIALS: 'add_credentials',
    VIEW_SALARY_SLIP: 'view_salary_slip',
    EDIT_EMPLOYEE_DETAILS: 'edit_employee_details',
    MARK_ATTENDANCE: 'mark_attendance',
    // Task Management permissions — deliberately kept as two separate
    // grants rather than one blanket permission, so HR can hand out
    // top-level task/team authority independently of subtask authority.
    // See taskAccess.js#hasFullTaskAccess / #hasSubtaskManageAccess for
    // every place each is checked.
    //
    // Top-level task authority: create/edit/delete top-level team/client/
    // event tasks, manage the WorkTeam/TaskClient/TaskEvent registries,
    // approve/reject reviews on top-level tasks.
    MANAGE_TASKS: 'manage_tasks',
    // Subtask authority: create subtasks, approve/reject subtask reviews,
    // continue a completed subtask, toggle follow-ups — independent of
    // MANAGE_TASKS above (a holder of one does not imply the other).
    MANAGE_SUBTASKS: 'manage_subtasks',
  },
  // Default seed for the shared step library (admin can add/edit/remove
  // freely afterward — these just give a new install something to start from).
  DEFAULT_STEP_LIBRARY: [
    'Plan of Action', 'Shoot', 'Edit', 'Design', 'Caption Writing', 'Schedule', 'Publish', 'Report',
  ],
  TASK_STATUS: { PENDING: 'pending', IN_PROGRESS: 'in_progress', DONE: 'done', MISSED: 'missed', ROLLED_OVER: 'rolled_over' },
  STEP_STATUS: { TODO: 'todo', IN_PROGRESS: 'in_progress', DONE: 'done' },
  APPROVAL_STATUS: { NOT_REQUIRED: 'not_required', PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' },
  DEFAULT_CYCLE_REMINDER_DAYS_BEFORE_END: 5,

  // What an inventory booking is for — "reason" in the product ask is this
  // selection, not a separate freeform taxonomy; BOOKING_NOTES below covers
  // any extra detail on top of it.
  INVENTORY_BOOKING_CONTEXT: { EVENT: 'event', CLIENT_TASK: 'client_task', OTHER: 'other' },
  INVENTORY_BOOKING_STATUS: { ACTIVE: 'active', RELEASED: 'released' },
  INVENTORY_RELEASED_BY_ROLE: { EMPLOYEE: 'employee', ADMIN: 'admin' },

  EVENT_MODE: { ONLINE: 'online', OFFLINE: 'offline' },
  EVENT_STATUS: { UPCOMING: 'upcoming', COMPLETED: 'completed', CANCELLED: 'cancelled' },
  EVENT_RESPONSIBILITY_STATUS: { PENDING: 'pending', DONE: 'done' },

  // Manually-entered calendar events (see CompanyEvent) — distinct from
  // employee birthdays, which are derived from Employee.dob instead.
  // CLIENT_BIRTHDAY/CLIENT_ANNIVERSARY/BRAND_ANNIVERSARY recur yearly
  // (month/day only, year on the stored date is never compared) — same as
  // an employee's DOB. IMPORTANT does NOT recur — it's a one-off marker
  // for a specific date (e.g. "board meeting"), matched on the full date.
  // See companyEvent.service.js#listForRange.
  COMPANY_EVENT_TYPE: {
    CLIENT_BIRTHDAY: 'client_birthday',
    CLIENT_ANNIVERSARY: 'client_anniversary',
    BRAND_ANNIVERSARY: 'brand_anniversary',
    IMPORTANT: 'important',
  },

  // Employee Task Management — distinct from TASK_STATUS/STEP_STATUS above,
  // which belong to the unrelated CMS Task/TaskCycle content-workflow
  // system (see EmployeeTask.js for why this couldn't reuse that system).
  EMPLOYEE_TASK_TYPE: { PERSONAL: 'personal', TEAM: 'team', CLIENT: 'client', EVENT: 'event' },
  EMPLOYEE_TASK_STATUS: { PENDING: 'pending', FOR_REVIEW: 'for_review', COMPLETED: 'completed' },
  EMPLOYEE_TASK_COMPLETION_FLAG: { ON_TIME: 'on_time', LATE: 'late' },
};
