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
  DEFAULT_UPLOAD_REQUEST_EXPIRY_HOURS: 72,
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
  },
  CLIENT_STATUS: { LEAD: 'lead', ONBOARDED: 'onboarded', OFFBOARDED: 'offboarded' },
  QUOTATION_STATUS: { DRAFT: 'draft', SHARED: 'shared', SIGNED: 'signed', SUPERSEDED: 'superseded' },
  DEFAULT_QUOTATION_SHARE_EXPIRY_HOURS: 24 * 14,
  USER_ROLES: { ADMIN: 'admin', WORKER: 'worker' },
  // Default seed for the shared step library (admin can add/edit/remove
  // freely afterward — these just give a new install something to start from).
  DEFAULT_STEP_LIBRARY: [
    'Plan of Action', 'Shoot', 'Edit', 'Design', 'Caption Writing', 'Schedule', 'Publish', 'Report',
  ],
  TASK_STATUS: { PENDING: 'pending', IN_PROGRESS: 'in_progress', DONE: 'done', MISSED: 'missed', ROLLED_OVER: 'rolled_over' },
  STEP_STATUS: { TODO: 'todo', IN_PROGRESS: 'in_progress', DONE: 'done' },
  APPROVAL_STATUS: { NOT_REQUIRED: 'not_required', PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' },
  DEFAULT_CYCLE_REMINDER_DAYS_BEFORE_END: 5,
};
