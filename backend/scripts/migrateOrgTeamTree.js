// Moves every team in the Organisation chart to the new shape:
//   Team → Content Manager (head) → its Social Media Managers → each SMM's own Videographer + Video Editor.
// The existing Videographer/Editor boxes go under each team's first SMM; every other SMM gets new, empty
// Videographer and Video Editor boxes. Nobody changes box. Writes a backup first. Pass --apply to change anything.
// Run from the backend folder: node scripts/migrateOrgTeamTree.js [--apply]
require('dotenv').config({ quiet: true });
const fs = require('fs');
const m = require('mongoose');
const path = require('path');
const APPLY = process.argv.includes('--apply');
(async () => {
  await m.connect(process.env.MONGODB_URI);
  const OrgNode = require('../src/models/OrgNode');
  const orgChart = require('../src/services/orgChart.service');
  const all = await OrgNode.find({}).lean();
  const emps = new Map((await m.connection.db.collection('employees').find({}).project({ firstName: 1, lastName: 1 }).toArray()).map((e) => [String(e._id), `${e.firstName} ${e.lastName || ''}`.trim()]));
  const who = (n) => n.assignees.map((a) => emps.get(String(a))).join(', ') || 'Vacant';
  if (APPLY) fs.writeFileSync(path.join(__dirname, `orgnodes-backup-${Date.now()}.json`), JSON.stringify(all));

  const teams = all.filter((n) => n.kind === 'team');
  for (const team of teams) {
    const roles = all.filter((n) => String(n.parent) === String(team._id) && n.kind === 'team_role');
    const head = roles.find((r) => r.isTeamHead);
    const smms = roles.filter((r) => r.teamRole === 'social_media_manager');
    const vids = roles.filter((r) => r.teamRole === 'videographer');
    const eds = roles.filter((r) => r.teamRole === 'editor');
    console.log(`\n${team.title}: head ${head ? `${head.title} (${who(head)})` : 'none'}; ${smms.length} SMM, ${vids.length} videographer, ${eds.length} editor box(es) directly under the team`);
    if (!head || !smms.length) { console.log('   skipped — needs a Content Manager box and at least one SMM box'); continue; }
    for (const [i, smm] of smms.entries()) {
      console.log(`   SMM "${smm.title}" (${who(smm)}) → under ${head.title}`);
      if (APPLY) await OrgNode.updateOne({ _id: smm._id }, { $set: { parent: head._id, order: i } });
    }
    const first = smms[0];
    for (const [i, box] of [...vids, ...eds].entries()) {
      console.log(`   ${box.title} (${who(box)}) → under SMM "${first.title}" (${who(first)})`);
      if (APPLY) await OrgNode.updateOne({ _id: box._id }, { $set: { parent: first._id, order: i } });
    }
    // The first SMM gets a Videographer/Editor box if the team had none.
    const need = (smm, isFirst) => [
      ...(!isFirst || !vids.length ? [{ title: 'Videographer', teamRole: 'videographer' }] : []),
      ...(!isFirst || !eds.length ? [{ title: 'Video Editor', teamRole: 'editor' }] : []),
    ];
    for (const [i, smm] of smms.entries()) {
      for (const [j, box] of need(smm, i === 0).entries()) {
        console.log(`   + new empty ${box.title} box under SMM "${smm.title}" (${who(smm)})`);
        if (APPLY) await OrgNode.create({ title: box.title, kind: 'team_role', teamRole: box.teamRole, parent: smm._id, order: 10 + j, assignees: [], isTeamHead: false });
      }
    }
    if (APPLY) await orgChart.syncTeam(team._id);
  }
  if (!APPLY) console.log('\n(dry run — nothing changed)');
  await m.disconnect();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
