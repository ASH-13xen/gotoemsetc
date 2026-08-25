const { Schema, model } = require('mongoose');
const { TEAM_MEMBER_ROLE } = require('../config/constants');

// Per-member roles *within this team*, deliberately separate from
// Employee.designation. designation is HR-owned, feeds salary slips and
// generated documents, and an employee can sit on more than one team — so
// writing a team-specific role back onto the employee would let joining team
// B silently overwrite the title they hold on team A.
//
// `roles` is a fixed multi-select (TEAM_MEMBER_ROLE) rather than the old
// single free-text field — a member can hold any number of the 9 roles at
// once, and any of the 9, including Social Media Manager, which used to be
// its own dedicated WorkTeam field. Collective assignment (e.g. two SMMs on
// one team both getting routed a daily story) depends on this being a set,
// not a single value — see utils/teamRoles.js#membersWithRole.
//
// Kept as a parallel array rather than reshaping `members` into subdocuments:
// `members` is matched directly by two raw Mongo queries
// (employeeTask.repository.js#getReviewScope, workTeam.repository.js#
// isLeaderOfMember) and by taskAccess.js#isAssignee, which gates access to
// every team/client/event task. Reshaping it would have touched all of those
// plus eight sites in frontendfollowups for no functional gain.
const memberRoleSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    roles: [{ type: String, enum: Object.values(TEAM_MEMBER_ROLE) }],
  },
  { _id: false }
);

// Task Management's team registry, also used by the Client Management System
// and Event Management. `leader` is required since team-task completion
// routing depends on there always being someone to route to — displayed
// everywhere in the UI as "Team Main" (this field keeps its name and its
// existing local authority; only the display label changed). The *global*
// Team Leader is a separate concept entirely — the `team_lead` login role,
// not tied to any one team — see utils/cmsAccess.js#isGlobalTeamLead.
const workTeamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    leader: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],

    // Optional per-member roles; absence just means "no roles recorded".
    memberRoles: [memberRoleSchema],

    isDeleted: { type: Boolean, default: false },

    // A team quick-created from Task Management for a one-off team task
    // (e.g. picking a few members ad hoc instead of using an existing team).
    // Persists like any other team — audit trail, task history — but is
    // hidden from the normal team registry/dropdowns; see
    // workTeam.repository.js#list.
    isTemporary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('WorkTeam', workTeamSchema);
