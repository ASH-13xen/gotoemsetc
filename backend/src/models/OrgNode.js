const { Schema, model } = require('mongoose');
const { ORG_NODE_KIND, TEAM_MEMBER_ROLE } = require('../config/constants');

// One box in the admin's Organisation chart. The tree is nothing more than
// each node pointing at its parent (null for the single root, Admin), so
// any level can be added, renamed, moved or removed without code changes.
// See orgChart.service.js for the rules (one root, no cycles, team roles
// only under teams) and for how team-role assignments are mirrored onto
// the linked WorkTeam.
const orgNodeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    kind: { type: String, enum: Object.values(ORG_NODE_KIND), default: ORG_NODE_KIND.POSITION },
    parent: { type: Schema.Types.ObjectId, ref: 'OrgNode', default: null, index: true },
    // Left-to-right position among siblings.
    order: { type: Number, default: 0 },
    // Whoever holds this box — any number, including none ("Vacant").
    assignees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    // Team boxes only — the WorkTeam (Task Management team) this box is.
    workTeam: { type: Schema.Types.ObjectId, ref: 'WorkTeam', default: null },
    // Team role boxes only — which WorkTeam role its assignees hold.
    teamRole: { type: String, enum: [...Object.values(TEAM_MEMBER_ROLE), null], default: null },
    // Team role boxes only — the team's head (the Content Manager); the
    // linked WorkTeam's leader follows this box's first assignee.
    isTeamHead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('OrgNode', orgNodeSchema);
