// Builds a working Client Management System setup end to end: one fully
// staffed team, one client per plan tier, a calendar for the current month
// each, and one of every content type scheduled — then audits what actually
// landed in both the CMS and Task Management.
//
// Idempotent: re-running reuses the same team/clients/calendars by name
// rather than duplicating. Pass --clean to remove everything it created.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const Employee = require('../src/models/Employee');
const WorkTeam = require('../src/models/WorkTeam');
const TaskClient = require('../src/models/TaskClient');
const ClientCalendar = require('../src/models/ClientCalendar');
const CalendarItem = require('../src/models/CalendarItem');
const EmployeeTask = require('../src/models/EmployeeTask');
const User = require('../src/models/User');
const clientCalendarService = require('../src/services/clientCalendar.service');
const calendarItemService = require('../src/services/calendarItem.service');
const istDate = require('../src/utils/istDate');
const { CMS_CONTENT_TYPE, CMS_PLAN, EMPLOYEE_STATUS, TEAM_MEMBER_ROLE } = require('../src/config/constants');

const TEAM_NAME = 'Content Team A';
const STAFF = [
  { key: 'leader', firstName: 'Riya', lastName: 'Kapoor', designation: 'Operation Manager', roles: [] },
  { key: 'smm', firstName: 'Aditya', lastName: 'Rao', designation: 'Social Media Manager', roles: [TEAM_MEMBER_ROLE.SOCIAL_MEDIA_MANAGER] },
  { key: 'designer', firstName: 'Neha', lastName: 'Iyer', designation: 'Graphic Designer', roles: [TEAM_MEMBER_ROLE.GRAPHIC_DESIGNER] },
  { key: 'shooter', firstName: 'Kabir', lastName: 'Sen', designation: 'Videographer', roles: [TEAM_MEMBER_ROLE.VIDEOGRAPHER] },
  { key: 'editor', firstName: 'Tara', lastName: 'Menon', designation: 'Video Editor', roles: [TEAM_MEMBER_ROLE.EDITOR] },
  { key: 'contentManager', firstName: 'Vikram', lastName: 'Das', designation: 'Content Manager', roles: [TEAM_MEMBER_ROLE.CONTENT_MANAGER] },
];
const CLIENTS = [
  { name: 'Aurora Cafe', brandName: 'Aurora', plan: CMS_PLAN.GOLD },
  { name: 'Vertex Fitness', brandName: 'Vertex', plan: CMS_PLAN.PLATINUM },
  { name: 'Lumen Skincare', brandName: 'Lumen', plan: CMS_PLAN.DIAMOND },
];

async function clean() {
  const clients = await TaskClient.find({ name: { $in: CLIENTS.map((c) => c.name) } }).select('_id');
  const clientIds = clients.map((c) => c._id);
  const calendars = await ClientCalendar.find({ client: { $in: clientIds } }).select('_id');
  const calendarIds = calendars.map((c) => c._id);

  const tasks = await EmployeeTask.deleteMany({
    $or: [{ cmsCalendar: { $in: calendarIds } }, { client: { $in: clientIds } }],
  });
  const items = await CalendarItem.deleteMany({ calendar: { $in: calendarIds } });
  await ClientCalendar.deleteMany({ _id: { $in: calendarIds } });
  await TaskClient.deleteMany({ _id: { $in: clientIds } });
  await WorkTeam.deleteMany({ name: TEAM_NAME });
  const emps = await Employee.deleteMany({
    firstName: { $in: STAFF.map((s) => s.firstName) },
    lastName: { $in: STAFF.map((s) => s.lastName) },
  });

  console.log(
    `Cleaned: ${emps.deletedCount} employees, 1 team, ${clientIds.length} clients, ` +
      `${calendarIds.length} calendars, ${items.deletedCount} items, ${tasks.deletedCount} tasks`
  );
}

async function upsertStaff() {
  const staff = {};
  for (const person of STAFF) {
    staff[person.key] = await Employee.findOneAndUpdate(
      { firstName: person.firstName, lastName: person.lastName, isDeleted: false },
      {
        $set: { designation: person.designation },
        $setOnInsert: { firstName: person.firstName, lastName: person.lastName, status: EMPLOYEE_STATUS.ACTIVE },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }
  return staff;
}

async function upsertTeam(staff) {
  const memberIds = ['smm', 'designer', 'shooter', 'editor', 'contentManager'].map((k) => staff[k]._id);
  return WorkTeam.findOneAndUpdate(
    { name: TEAM_NAME },
    {
      $set: {
        leader: staff.leader._id,
        members: memberIds,
        description: 'Demo content team — Team Main, social media manager, designer, videographer, editor, content manager.',
        memberRoles: STAFF.filter((s) => s.roles.length > 0).map((s) => ({ employee: staff[s.key]._id, roles: s.roles })),
        isDeleted: false,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

async function main() {
  await mongoose.connect(env.mongodbUri);

  if (process.argv.includes('--clean')) {
    await clean();
    await mongoose.disconnect();
    return;
  }

  // Acts as the admin account, which owns Client Management writes.
  const adminUser = await User.findOne({ username: 'admin' }).lean();
  if (!adminUser) throw new Error('No "admin" user — run scripts/seedUsers.js first');
  const actingUser = {
    id: adminUser._id.toString(),
    role: adminUser.role,
    employeeLink: adminUser.employeeLink ? adminUser.employeeLink.toString() : null,
    permissions: adminUser.permissions || [],
  };

  const staff = await upsertStaff();
  const team = await upsertTeam(staff);
  console.log(`Team "${team.name}": Team Main ${staff.leader.firstName}, SMM ${staff.smm.firstName}, +4 members\n`);

  const { year, month } = istDate.istToday ? istDate.istToday() : istDate.istParts(new Date());
  const monthDays = istDate.istDaysInMonth(year, month);

  for (const def of CLIENTS) {
    const client = await TaskClient.findOneAndUpdate(
      { name: def.name },
      {
        $set: {
          brandName: def.brandName,
          defaultTeam: team._id,
          currentPlan: def.plan,
          isDeleted: false,
          contacts: [{ name: `${def.brandName} Owner`, role: 'Owner', email: `owner@${def.brandName.toLowerCase()}.example`, phone: '9800000000', isPrimary: true }],
          location: { city: 'Indore', state: 'Madhya Pradesh', country: 'India' },
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    let calendar = await ClientCalendar.findOne({ client: client._id, year, month, isDeleted: false });
    if (!calendar) {
      calendar = await clientCalendarService.createCalendar(
        { clientId: client._id.toString(), year, month, generateDailyStories: true },
        actingUser
      );

      // One of every non-story type, on spread-out dates.
      const mid = Math.min(12, monthDays);
      await calendarItemService.scheduleItem(
        calendar,
        {
          type: CMS_CONTENT_TYPE.POST,
          scheduledDate: istDate.istInstant(year, month, mid, 12, 0),
          assignments: { designer: staff.designer._id.toString() },
          brief: { postingName: `${def.brandName} launch post`, uploadDestination: 'Instagram' },
        },
        actingUser
      );
      await calendarItemService.scheduleItem(
        calendar,
        {
          type: CMS_CONTENT_TYPE.REEL,
          scheduledDate: istDate.istInstant(year, month, Math.min(20, monthDays), 12, 0),
          assignments: {
            shooter: staff.shooter._id.toString(),
            editor: staff.editor._id.toString(),
            contentManager: staff.contentManager._id.toString(),
          },
          brief: { postingName: `${def.brandName} behind the scenes` },
        },
        actingUser
      );
      await calendarItemService.scheduleItem(
        calendar,
        {
          type: CMS_CONTENT_TYPE.FESTIVE_STORY,
          festiveWorkflow: 'post',
          scheduledDate: istDate.istInstant(year, month, Math.min(25, monthDays), 12, 0),
          assignments: { designer: staff.smm._id.toString() },
          brief: { postingName: `${def.brandName} festive greeting` },
        },
        actingUser
      );
    }

    await audit(client, calendar, def, monthDays);
  }

  await mongoose.disconnect();
}

// Reports what actually exists on both sides, so a mismatch between the
// calendar and Task Management is visible rather than assumed away.
async function audit(client, calendar, def, monthDays) {
  const fresh = await ClientCalendar.findById(calendar._id).lean();
  const items = await CalendarItem.find({ calendar: calendar._id, isDeleted: false }).lean();
  const counts = (type) => items.filter((i) => i.type === type).length;

  const topLevel = await EmployeeTask.find({ client: client._id, parentTask: null, isDeleted: false }).lean();
  const subtasks = await EmployeeTask.find({ client: client._id, parentTask: { $ne: null }, isDeleted: false }).lean();
  const storyParent = fresh.dailyStoryTask
    ? await EmployeeTask.findById(fresh.dailyStoryTask).lean()
    : null;
  const storySubs = storyParent
    ? await EmployeeTask.countDocuments({ parentTask: storyParent._id, isDeleted: false })
    : 0;

  const q = fresh.quotas;
  console.log(`--- ${client.name} (${def.plan.toUpperCase()}) ---`);
  console.log(
    `  quotas          posts ${q.posts.label} · reels ${q.reels.label} · ` +
      `stories ${q.dailyStoriesPerDay.label}/day · festive ${q.festiveStories.label}`
  );
  console.log(
    `  CMS items       post ${counts('post')} · reel ${counts('reel')} · ` +
      `story ${counts('story')} · festive ${counts('festive_story')}   (total ${items.length})`
  );
  console.log(`  top-level tasks ${topLevel.length}  [${topLevel.map((t) => t.title).join(', ')}]`);
  console.log(`  subtasks        ${subtasks.length}`);
  console.log(
    `  daily stories   ${storyParent ? `1 parent "${storyParent.title}" with ${storySubs} day subtasks` : 'MISSING'}`
  );

  const problems = [];
  if (counts('story') !== monthDays) problems.push(`expected ${monthDays} story items, found ${counts('story')}`);
  if (storySubs !== monthDays) problems.push(`expected ${monthDays} story subtasks, found ${storySubs}`);
  // One shared story parent + post + reel + festive = 4 top-level tasks.
  if (topLevel.length !== 4) problems.push(`expected 4 top-level tasks, found ${topLevel.length}`);
  const reelSubs = subtasks.filter((s) => ['shoot', 'edit', 'content_manager'].includes(s.cmsRole));
  if (reelSubs.length !== 3) problems.push(`expected 3 reel subtasks, found ${reelSubs.length}`);
  const edit = reelSubs.find((s) => s.cmsRole === 'edit');
  if (edit && !edit.blockedBy) problems.push('reel edit is not blocked by its shoot');
  const contentManager = reelSubs.find((s) => s.cmsRole === 'content_manager');
  if (contentManager && !contentManager.blockedBy) problems.push('reel content manager subtask is not blocked by its edit');

  console.log(problems.length ? `  ISSUES: ${problems.join('; ')}` : '  OK — CMS and Task Management agree');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
