require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const OrgNode = require('../src/models/OrgNode');
const WorkTeam = require('../src/models/WorkTeam');
const Employee = require('../src/models/Employee');
const orgChartService = require('../src/services/orgChart.service');
const { ORG_NODE_KIND, TEAM_MEMBER_ROLE, EMPLOYEE_STATUS } = require('../src/config/constants');

// One-off: builds the starting Organisation chart —
//   Admin → CEO / CTO / CFO; CEO → Operations, HR, Sales, Team Lead;
//   Team Lead → ALPHA … ECHO, each with Content Manager (team head),
//   Social Media Manager, Videographer, Video Editor.
// Each team box links to the existing WorkTeam of the same name, and that
// team's current leader becomes its Content Manager (if still active). Everything else
// starts vacant. Refuses to run if a chart already exists.
const TEAMS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
const TEAM_ROLES = [
  { title: 'Content Manager', teamRole: TEAM_MEMBER_ROLE.CONTENT_MANAGER, isTeamHead: true },
  { title: 'Social Media Manager', teamRole: TEAM_MEMBER_ROLE.SOCIAL_MEDIA_MANAGER },
  { title: 'Videographer', teamRole: TEAM_MEMBER_ROLE.VIDEOGRAPHER },
  { title: 'Video Editor', teamRole: TEAM_MEMBER_ROLE.EDITOR },
];

async function main() {
  await mongoose.connect(env.mongodbUri);
  if (await OrgNode.exists({})) {
    console.log('An organisation chart already exists — nothing done.');
    await mongoose.disconnect();
    return;
  }

  const add = (data) => orgChartService.createNode(data);
  const admin = await add({ title: 'Admin', description: 'Top of the organisation' });
  const ceo = await add({ title: 'CEO', description: 'Chief Executive Officer', parent: admin._id });
  await add({ title: 'CTO', description: 'Chief Technology Officer', parent: admin._id });
  await add({ title: 'CFO', description: 'Chief Financial Officer', parent: admin._id });
  for (const title of ['Operations', 'HR', 'Sales']) {
    // eslint-disable-next-line no-await-in-loop
    await add({ title, parent: ceo._id });
  }
  const teamLead = await add({ title: 'Team Lead', parent: ceo._id });

  for (const name of TEAMS) {
    // eslint-disable-next-line no-await-in-loop
    const workTeam = await WorkTeam.findOne({ name, isDeleted: false });
    // eslint-disable-next-line no-await-in-loop
    const team = await add({ title: name, kind: ORG_NODE_KIND.TEAM, parent: teamLead._id, workTeam: workTeam?._id });
    for (const role of TEAM_ROLES) {
      // eslint-disable-next-line no-await-in-loop
      const roleNode = await add({ ...role, kind: ORG_NODE_KIND.TEAM_ROLE, parent: team._id });
      if (role.isTeamHead && workTeam?.leader) {
        // eslint-disable-next-line no-await-in-loop
        const leader = await Employee.findById(workTeam.leader).select('status firstName');
        if (leader?.status === EMPLOYEE_STATUS.ACTIVE) {
          // eslint-disable-next-line no-await-in-loop
          await orgChartService.setAssignees(roleNode._id, [workTeam.leader.toString()]);
        } else {
          console.log(`${name}: leader ${leader?.firstName || ''} is not active — Content Manager left vacant`);
        }
      }
    }
    console.log(`${name}: ${workTeam ? 'linked to work team' : 'NO matching work team — box is chart-only'}`);
  }

  console.log(`Created ${await OrgNode.countDocuments()} boxes.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
