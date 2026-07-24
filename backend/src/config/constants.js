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
  // attendance calendar — P/O/H/L/SL/W are the only marks; a day off
  // (Sunday or an admin-marked Holiday) needs no status at all.
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

  // Manually-entered recurring calendar events (see CompanyEvent) — distinct
  // from employee birthdays, which are derived from Employee.dob instead.
  COMPANY_EVENT_TYPE: {
    CLIENT_BIRTHDAY: 'client_birthday',
    CLIENT_ANNIVERSARY: 'client_anniversary',
    BRAND_ANNIVERSARY: 'brand_anniversary',
  },
};
