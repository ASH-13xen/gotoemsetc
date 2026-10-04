// One-off: wires the Organisation chart's posts to the access they give.
//  * existing position boxes get "Gives access of" by their title
//    (CEO, CTO, CFO, HR, Operations, Sales, Team Lead);
//  * Digital Admin and Technical are added under CTO;
//  * the top Admin box is emptied — admin is the admin login only.
// Safe to re-run: it only fills in what's missing.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const OrgNode = require('../src/models/OrgNode');
const { USER_ROLES: R, ORG_NODE_KIND } = require('../src/config/constants');

const BY_TITLE = {
  CEO: R.CEO,
  CTO: R.CTO,
  CFO: R.CFO,
  HR: R.HR,
  OPERATIONS: R.OPERATIONS_MANAGER,
  SALES: R.SALES,
  'TEAM LEAD': R.TEAM_LEAD,
  'DIGITAL ADMIN': R.DIGITAL_ADMIN,
  TECHNICAL: R.TECHNICAL,
};

(async () => {
  await mongoose.connect(env.mongodbUri);

  const root = await OrgNode.findOne({ parent: null });
  if (root && root.assignees.length) {
    console.log(`Admin box: removed ${root.assignees.length} person(s) — admin is the admin login only`);
    root.assignees = [];
    root.grantsRole = null;
    await root.save();
  }

  const positions = await OrgNode.find({ kind: ORG_NODE_KIND.POSITION, parent: { $ne: null } });
  for (const node of positions) {
    const role = BY_TITLE[node.title.trim().toUpperCase()];
    if (role && !node.grantsRole) {
      node.grantsRole = role;
      await node.save();
      console.log(`${node.title.padEnd(14)} → gives ${role}`);
    }
  }

  const cto = await OrgNode.findOne({ grantsRole: R.CTO });
  if (cto) {
    for (const [title, role] of [
      ['Digital Admin', R.DIGITAL_ADMIN],
      ['Technical', R.TECHNICAL],
    ]) {
      if (await OrgNode.exists({ grantsRole: role })) continue;
      const order = await OrgNode.countDocuments({ parent: cto._id });
      await OrgNode.create({ title, kind: ORG_NODE_KIND.POSITION, parent: cto._id, order, grantsRole: role });
      console.log(`Added "${title}" under CTO → gives ${role}`);
    }
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
