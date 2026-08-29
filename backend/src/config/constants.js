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
    // Only a single biometric scan all day (can't tell arrival from
    // departure) — see attendanceWarning.service.js#computeDailyReport's
    // single_scan bucket. Uses the exact same sendWarning/monthly-count/
    // pending-modal machinery as every other category above.
    SINGLE_SCAN: 'single_scan',
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
    single_scan: [
      'You scanned in only once today, so your arrival or departure time could not be determined — please remember to scan both when arriving and leaving.',
      'This is a repeated instance of only scanning once — please make sure to scan the biometric device both on arrival and on departure.',
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
    EVENT_RESPONSIBILITY_ASSIGNED: 'event_responsibility_assigned',
    ATTENDANCE_NO_SCAN: 'attendance_no_scan',
    ATTENDANCE_SINGLE_SCAN: 'attendance_single_scan',
    ATTENDANCE_UNCLASSIFIED: 'attendance_unclassified',
    ATTENDANCE_MODIFICATION_REQUESTED: 'attendance_modification_requested',
    // A leave application that needs the applicant's team's Content
    // Manager to review it before it ever reaches HR — see
    // attendanceRequest.service.js#resolveApprovalStage.
    LEAVE_APPLICATION_PENDING_CM_REVIEW: 'leave_application_pending_cm_review',
    // Fired whenever HR (not admin) manually marks/edits an attendance day —
    // carries HR's required reason, notified to admins for oversight. See
    // attendance.service.js#markAttendance.
    ATTENDANCE_MANUAL_EDIT: 'attendance_manual_edit',
    // Client birthday/anniversary or brand anniversary — manually entered
    // (see CompanyEvent) rather than derived from an Employee record, unlike
    // BIRTHDAY_TODAY/UPCOMING above.
    COMPANY_EVENT_TODAY: 'company_event_today',
    COMPANY_EVENT_UPCOMING: 'company_event_upcoming',
    // Task Management.
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
    // Client Management System — approval pipeline transitions. Client tasks
    // deliberately send no email at all (see employeeTask.service.js), so
    // these in-app notifications are the only signal an approver gets.
    CMS_APPROVAL_PENDING: 'cms_approval_pending',
    CMS_ITEM_SENT_BACK: 'cms_item_sent_back',
    CMS_ITEM_REJECTED: 'cms_item_rejected',
    CMS_ITEM_PUBLISHED: 'cms_item_published',
    // Operations — see complaint.service.js. Filed notifies admins + the
    // operations_manager role; completed notifies the employee who filed it,
    // prompting them for the speed/quality review.
    COMPLAINT_FILED: 'complaint_filed',
    COMPLAINT_COMPLETED: 'complaint_completed',
    // Client Manual — Meetings/MOM. See meeting.service.js and
    // jobs/meetingReminder.job.js.
    MEETING_SCHEDULED: 'meeting_scheduled',
    MEETING_RESCHEDULED: 'meeting_rescheduled',
    MEETING_CANCELLED: 'meeting_cancelled',
    MEETING_MOM_LATE: 'meeting_mom_late',
    // Finance section. See fnfSettlement/invoice/monthlyBill/reimbursement
    // services and jobs/monthlyBillCycle.job.js, jobs/reimbursementPaymentReminder.job.js.
    SALARY_SLIP_PAID: 'salary_slip_paid',
    FNF_SETTLEMENT_PAID: 'fnf_settlement_paid',
    INVOICE_PENDING_APPROVAL: 'invoice_pending_approval',
    INVOICE_APPROVED: 'invoice_approved',
    INVOICE_SENT: 'invoice_sent',
    INVOICE_PAID: 'invoice_paid',
    MONTHLY_BILL_DUE_REMINDER: 'monthly_bill_due_reminder',
    REIMBURSEMENT_CLAIMED: 'reimbursement_claimed',
    REIMBURSEMENT_APPROVED: 'reimbursement_approved',
    REIMBURSEMENT_REJECTED: 'reimbursement_rejected',
    REIMBURSEMENT_PAYMENT_REMINDER: 'reimbursement_payment_reminder',
    REIMBURSEMENT_PAID: 'reimbursement_paid',
    // Performance flag milestones — see employee.service.js#addFlag. Message
    // text distinguishes the 3/6/10 tiers rather than a type per tier.
    EMPLOYEE_RED_FLAG_MILESTONE: 'employee_red_flag_milestone',
    EMPLOYEE_GREEN_FLAG_MILESTONE: 'employee_green_flag_milestone',
    // Sales chatbot — fired the moment a lead needs a human (bot handoff,
    // meeting offer, the "talk to a human" button, or the fallback form).
    // See services/salesChat/notify.js.
    SALES_LEAD_ROUTED: 'sales_lead_routed',
  },
  // HR sits below Admin but is treated as admin-equivalent everywhere except
  // one explicit restriction (can't edit attendance older than 2 days — see
  // attendance.service.js#assertCanEditAttendanceDate). See
  // auth.middleware.js's isAdminLike for where this equivalence is applied.
  //
  // The five roles below (CEO through OPERATIONS_MANAGER) are mostly
  // placeholders: each exists so frontendall can render a different
  // dashboard per role, but isn't otherwise wired into any authorisation
  // check. They behave like a worker with zero permissions — sign in, see
  // the shell, and every admin-gated route refuses them — with two deliberate
  // exceptions: CEO is folded into requireHrWorkAccess()/
  // requireAttendanceApprovalAccess() (see auth.middleware.js), and
  // OPERATIONS_MANAGER (alongside admin/ceo) is folded into
  // requireOperationsAccess() for the Operations module (complaint.*,
  // keyHolder.* — reassigning who holds an office key) — notably NOT into
  // isAdminLike, so HR stays excluded from Operations.
  //
  // TEAM_LEAD here is a *login role*, deliberately distinct from
  // WorkTeam.leader, which is a per-team assignment and is what actually
  // grants task/calendar authority. Holding this role does not make anyone a
  // team's leader, and being a team's leader does not require it.
  //
  // There is deliberately no SALES role: it was removed once the org chart
  // settled. Client Management write access, which it used to carry, now sits
  // with admin alone — see isCmsAdmin() in utils/cmsAccess.js.
  USER_ROLES: {
    ADMIN: 'admin',
    WORKER: 'worker',
    HR: 'hr',
    CEO: 'ceo',
    DIGITAL_ADMIN: 'digital_admin',
    TEAM_LEAD: 'team_lead',
    ACCOUNT_MANAGER: 'account_manager',
    OPERATIONS_MANAGER: 'operations_manager',
  },
  // Org chart for the login roles above: admin at the top, ceo beneath it,
  // the four function heads reporting to ceo, and ordinary employees under
  // HR — HR owns the employee record, so that's where the reporting line
  // sits regardless of which team a person works on day to day.
  //
  // IMPORTANT: this is descriptive, not an authorisation mechanism. Being
  // above another role here grants nothing — no route consults it, and
  // isAdminLike()/isCmsAdmin() are unchanged. It exists so the shell can
  // order and pick dashboards per role, and so a future permission model has
  // the shape already agreed. Wiring inheritance in later is a deliberate
  // decision, not something that should happen by accident.
  ROLE_HIERARCHY: {
    admin: { level: 0, reportsTo: null, label: 'Admin' },
    ceo: { level: 1, reportsTo: 'admin', label: 'CEO' },
    digital_admin: { level: 2, reportsTo: 'ceo', label: 'Digital Admin' },
    hr: { level: 2, reportsTo: 'ceo', label: 'HR' },
    operations_manager: { level: 2, reportsTo: 'ceo', label: 'Operations Manager' },
    account_manager: { level: 2, reportsTo: 'ceo', label: 'Account Manager' },
    team_lead: { level: 2, reportsTo: 'ceo', label: 'Team Lead' },
    worker: { level: 3, reportsTo: 'hr', label: 'Employee' },
  },

  ATTENDANCE_REQUEST_STATUS: {
    PENDING: 'pending',
    RESOLVED: 'resolved',
    REJECTED: 'rejected',
    REVOKED: 'revoked',
  },
  // The subset of ATTENDANCE_STATUS the structured "apply for leave" flow
  // (frontendall) lets an employee pick from — Short Leave, Late, Half Day,
  // Leave, Work From Home. Deliberately excludes P/A/HL, which aren't
  // things an employee applies for in advance. See
  // attendanceRequest.validator.js#create. The existing free-text request
  // flow in frontendems never sets this at all. "Early Departure" is a
  // separate, independent flag (requestedEarlyDeparture) rather than a
  // member of this list — see AttendanceModificationRequest.js.
  LEAVE_APPLICATION_STATUSES: ['SL', 'L', 'H', 'O', 'W'],
  // Two-stage approval for a structured leave application — see
  // attendanceRequest.service.js#resolveApprovalStage. A free-text
  // modification request (frontendems) always starts and stays at 'hr'.
  ATTENDANCE_REQUEST_APPROVAL_STAGE: { CONTENT_MANAGER: 'content_manager', HR: 'hr' },
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
  // ---------------------------------------------------------------------
  // Operations — Complaint Register
  // ---------------------------------------------------------------------
  // Any employee can file one against a fixed category list; it's routed to
  // Operations (admin/ceo/operations_manager — see requireOperationsAccess()
  // in auth.middleware.js), marked completed there, then sent back to the
  // filer for a speed/quality star rating. See models/Complaint.js and
  // services/complaint.service.js for the full timestamped lifecycle.
  COMPLAINT_CATEGORY: {
    WIFI: 'wifi',
    CLEANING: 'cleaning',
    ELECTRICAL: 'electrical',
    CARPENTER: 'carpenter',
    PLUMBER: 'plumber',
    GROCERY: 'grocery',
    WASHROOM: 'washroom',
    PARKING: 'parking',
    OTHERS: 'others',
  },
  // pending (just filed) -> completed (Operations marked it done, awaiting
  // the filer's review) -> reviewed (filer left feedback; terminal).
  COMPLAINT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    REVIEWED: 'reviewed',
  },
  // ---------------------------------------------------------------------
  // Operations — Office Keys
  // ---------------------------------------------------------------------
  // The office's 5 physical keys — a fixed set, not a user-manageable list.
  // Every employee can see who currently holds each (frontendall dashboard);
  // only admin/ceo/operations_manager can reassign one — see
  // requireOperationsAccess() and keyHolder.service.js. Display labels/colors
  // live frontend-side (frontendall/src/api/keys.api.ts), same split as
  // COMPLAINT_CATEGORY above.
  OFFICE_KEY: {
    GO_TO_OFFICE: 'go_to_office',
    THE_ARCADE: 'the_arcade',
    THE_VERVE_STUDIOS: 'the_verve_studios',
    CUPBOARD: 'cupboard',
    MAIN_GATE: 'main_gate',
  },
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

  // Task Management. Client-type tasks are driven by the Client Management
  // System's content calendar — see EmployeeTask.js.
  EMPLOYEE_TASK_TYPE: { PERSONAL: 'personal', TEAM: 'team', CLIENT: 'client', EVENT: 'event' },
  EMPLOYEE_TASK_STATUS: { PENDING: 'pending', FOR_REVIEW: 'for_review', COMPLETED: 'completed' },
  EMPLOYEE_TASK_COMPLETION_FLAG: { ON_TIME: 'on_time', LATE: 'late' },

  // Tags a WorkTeam member can hold, any number at once — deliberately not a
  // single dedicated field per role (the way socialMediaManager used to be):
  // the spec requires collective assignment when a team has more than one
  // person tagged with the same role (e.g. two SMMs sharing daily stories).
  // See WorkTeam.js#memberRoleSchema and utils/teamRoles.js#membersWithRole.
  TEAM_MEMBER_ROLE: {
    VIDEOGRAPHER: 'videographer',
    EDITOR: 'editor',
    SOCIAL_MEDIA_MANAGER: 'social_media_manager',
    CONTENT_MANAGER: 'content_manager',
    GRAPHIC_DESIGNER: 'graphic_designer',
    EVENT_MANAGER: 'event_manager',
    PODCAST_MANAGER: 'podcast_manager',
    PODCAST_SALES: 'podcast_sales',
    MARKETING_SALES: 'marketing_sales',
  },

  // ---------------------------------------------------------------------
  // Client Management System
  // ---------------------------------------------------------------------
  CMS_PLAN: { GOLD: 'gold', PLATINUM: 'platinum', DIAMOND: 'diamond' },

  // What each plan commits to per month. `label` is what the UI shows as the
  // counter's denominator and is a deliberate *string* — several tiers are
  // ranges ("6-8"), not numbers, and the product spec is explicit that the
  // range is shown verbatim rather than resolved to a single figure. min/max
  // exist only so the month-end report can compute fulfilment percentages;
  // nothing renders them directly.
  //
  // Numerators are always integers and are allowed to exceed the denominator
  // (7/6-8 is a valid, non-error state — over-delivery, not a bug).
  //
  // dailyStoriesPerDay is per *day*, unlike the other three which are per
  // month — see cmsReport.service.js for how that changes its denominator.
  CMS_PLAN_QUOTAS: {
    gold: {
      posts: { label: '6', min: 6, max: 6 },
      reels: { label: '6', min: 6, max: 6 },
      dailyStoriesPerDay: { label: '1', min: 1, max: 1 },
      festiveStories: { label: '2', min: 2, max: 2 },
    },
    platinum: {
      posts: { label: '6-8', min: 6, max: 8 },
      reels: { label: '6-8', min: 6, max: 8 },
      dailyStoriesPerDay: { label: '1-2', min: 1, max: 2 },
      festiveStories: { label: '2-4', min: 2, max: 4 },
    },
    diamond: {
      posts: { label: '8', min: 8, max: 8 },
      reels: { label: '8', min: 8, max: 8 },
      dailyStoriesPerDay: { label: '2-3', min: 2, max: 3 },
      festiveStories: { label: '2-4', min: 2, max: 4 },
    },
  },

  CMS_CONTENT_TYPE: {
    POST: 'post',
    REEL: 'reel',
    STORY: 'story',
    FESTIVE_STORY: 'festive_story',
  },

  // Which quota key each content type counts against. STORY maps to the
  // per-day quota rather than a monthly total.
  CMS_CONTENT_TYPE_QUOTA_KEY: {
    post: 'posts',
    reel: 'reels',
    story: 'dailyStoriesPerDay',
    festive_story: 'festiveStories',
  },

  // Which literal pipeline drives an item. `story`/`post`/`reel` map 1:1 to
  // CMS_CONTENT_TYPE; `festive_story` has no table of its own — it borrows
  // post's or reel's, per CalendarItem.festiveWorkflow, chosen once at
  // scheduling time. See config/cmsPipelines.js.
  CMS_PIPELINE_KIND: { STORY: 'story', POST: 'post', REEL: 'reel' },

  // Every step of every pipeline, keyed by kind. Each pipeline is a flat,
  // ordered sequence — no branching, no gate-skip tables like the old
  // generic engine had (that logic now lives once, generically, in
  // cmsWorkflow.service.js's same-person auto-skip). See
  // config/cmsPipelines.js for who's responsible at each step and whether it
  // has an underlying Task Management subtask.
  CMS_STORY_STEP: {
    CREATED: 'created',
    SMM_DONE: 'smm_done',
    LEAD_DONE: 'lead_done', // terminal
  },
  CMS_POST_STEP: {
    CREATED: 'created',
    SMM_DONE: 'smm_done',
    LEAD_APPROVED: 'lead_approved',
    SENT_TO_CLIENT: 'sent_to_client',
    CLIENT_APPROVED: 'client_approved',
    DONE: 'done', // terminal
  },
  CMS_REEL_STEP: {
    CREATED: 'created',
    VIDEOGRAPHER_DONE: 'videographer_done',
    EDITOR_DONE: 'editor_done',
    SMM_DONE: 'smm_done',
    CONTENT_MANAGER_DONE: 'content_manager_done',
    LEAD_DONE: 'lead_done',
    SENT_TO_CLIENT: 'sent_to_client',
    CLIENT_APPROVED: 'client_approved',
    DONE: 'done', // terminal
  },

  // Pink/red are universal overrides layered on top of whatever step an item
  // is currently at — not steps of their own, exactly like `isRejected`
  // worked in the old engine. Pink is transient (clears the next time the
  // step it sent back to is completed forward again); red is terminal.
  CMS_OVERRIDE_FLAG: { SENT_BACK: 'sent_back', REJECTED: 'rejected' },

  // Placeholder palette, one map per pipeline kind plus the universal
  // overrides — re-theming is a single edit here, never a hunt through
  // components. Literal colour names are the spec's own, verbatim.
  CMS_STAGE_COLORS: {
    story: {
      created: '#795548', // brown
      smm_done: '#22c55e', // green
      lead_done: '#14b8a6', // teal — terminal
    },
    post: {
      created: '#f97316', // orange
      smm_done: '#22c55e', // green
      lead_approved: '#14b8a6', // teal
      sent_to_client: '#84cc16', // parrot green
      client_approved: '#a855f7', // purple
      done: '#e6d9b8', // cream — terminal
    },
    reel: {
      created: '#eab308', // yellow
      videographer_done: '#06b6d4', // aqua
      editor_done: '#3b82f6', // blue
      smm_done: '#22c55e', // green
      content_manager_done: '#ffb385', // peach
      lead_done: '#14b8a6', // teal
      sent_to_client: '#84cc16', // parrot green
      client_approved: '#a855f7', // purple
      done: '#e6d9b8', // cream — terminal
    },
    // Overrides — applied on top of whichever colour above is current.
    sent_back: '#f9a8d4', // pink
    rejected: '#ef4444', // red
    overdue: '#6b7280', // grey, unrelated to the spec's palette — carried
    // forward from the old engine per this session's "carry forward
    // peripheral behaviour" decision.
  },

  // Which subtask a piece of work is, on a CMS-owned client task. A post and
  // a story have one; a reel has three (videographer, editor, content
  // manager), each gated on the one before it (EmployeeTask.blockedBy).
  CMS_TASK_ROLE: {
    DESIGN: 'design',
    VIDEOGRAPHER: 'videographer',
    EDITOR: 'editor',
    CONTENT_MANAGER: 'content_manager',
    STORY: 'story',
  },

  // ---------------------------------------------------------------------
  // Client Manual — Meetings/MOM
  // ---------------------------------------------------------------------
  MEETING_STATUS: { SCHEDULED: 'scheduled', COMPLETED: 'completed', CANCELLED: 'cancelled' },

  // What a MOM's "any more tasks required?" step can spawn. Personal/team
  // reuse EmployeeTask's existing creation paths untouched; pipeline is a
  // new, deliberately off-calendar tracked task — see
  // employeeTask.service.js and utils/momPipeline.js.
  MOM_TASK_KIND: { PERSONAL: 'personal', TEAM: 'team', PIPELINE: 'pipeline' },
  MOM_PIPELINE_KIND: { POST: 'post', REEL: 'reel', CUSTOM: 'custom' },

  // ---------------------------------------------------------------------
  // Finance
  // ---------------------------------------------------------------------
  // Shared by SalarySlip and FnfSettlement — both are just "due until
  // someone in Finance pays it and records how."
  PAYMENT_STATUS: { DUE: 'due', PAID: 'paid' },

  INVOICE_STATUS: {
    PENDING_APPROVAL: 'pending_approval',
    APPROVED: 'approved',
    SENT: 'sent',
    PAID: 'paid',
  },

  // Resolved at the moment of marking paid (now vs. the instance's dueDate)
  // — same computed-flag pattern as EMPLOYEE_TASK_COMPLETION_FLAG's
  // on_time/late. See monthlyBill.service.js#markBillPaid.
  MONTHLY_BILL_INSTANCE_STATUS: { DUE: 'due', PAID: 'paid', PAID_LATE: 'paid_late' },

  REIMBURSEMENT_CATEGORY: {
    CLIENT_WORK: 'client_work',
    GROCERY: 'grocery',
    TRAVEL: 'travel',
    STATIONERY: 'stationery',
    INFLUENCER: 'influencer',
    CAMERA_ACCESSORIES: 'camera_accessories',
    META_ADS: 'meta_ads',
    MISCELLANEOUS: 'miscellaneous',
  },
  REIMBURSEMENT_TRAVEL_MODE: { CAB: 'cab', BIKE_PETROL: 'bike_petrol' },
  REIMBURSEMENT_STATUS: { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', PAID: 'paid' },

  // ---------------------------------------------------------------------
  // Sales chatbot — public landing page (folder: /sales), routes:
  // /api/sales-chat. An always-on AI qualifier that runs a short discovery
  // conversation, scores the lead, and routes it. WhatsApp / Meta / calendar
  // booking are deliberately out of this first slice. See
  // services/salesChat/* and models/SalesLead|SalesConversation|SalesKbDoc.
  // ---------------------------------------------------------------------
  // Where the lead is in its lifecycle. new -> engaged the moment they send
  // a first message; qualified once there's a contact detail and a score in
  // band C or better; routed once the bot has offered a meeting or a human;
  // disqualified on a hard knock-out (competitor, job seeker, no budget…).
  SALES_LEAD_STATUS: {
    NEW: 'new',
    ENGAGED: 'engaged',
    QUALIFIED: 'qualified',
    ROUTED: 'routed',
    DISQUALIFIED: 'disqualified',
  },
  SALES_CONVERSATION_STATUS: { OPEN: 'open', HANDOFF: 'handoff', CLOSED: 'closed' },
  // Where a routed lead goes. self_book is the "bot offered a slot" path
  // (calendar integration lands later — until then it behaves like
  // exec_queue with a note); ceo_track is reserved for band-A leads who
  // explicitly asked to talk.
  SALES_ROUTING_DESTINATION: {
    SELF_BOOK: 'self_book',
    EXEC_QUEUE: 'exec_queue',
    CEO_TRACK: 'ceo_track',
    NURTURE: 'nurture',
    DISQUALIFY: 'disqualify',
  },
  SALES_SCORE_BAND: { A: 'A', B: 'B', C: 'C', D: 'D' },
  // What the bot should do next, decided deterministically after each turn
  // (never left to the model) — see services/salesChat/orchestrator.js.
  SALES_NEXT_ACTION: {
    CONTINUE: 'continue',
    OFFER_MEETING: 'offer_meeting',
    OFFER_HANDOFF: 'offer_handoff',
    DISQUALIFY: 'disqualify',
  },
  // Knowledge-base document kinds. case_study is the only one the bot can
  // quote past results from; offer/service back get_offers; the rest are
  // grounding context. Nothing about price is ever generated free-hand.
  SALES_KB_TYPE: {
    CASE_STUDY: 'case_study',
    SERVICE: 'service',
    OFFER: 'offer',
    FAQ: 'faq',
    OBJECTION: 'objection',
  },
  SALES_KB_STATUS: { ACTIVE: 'active', ARCHIVED: 'archived' },
  SALES_CHAT_CHANNEL: { WEB: 'web' },
};
