# Client Management System (CMS) — Implementation Plan

Status: **built.** All phases complete; see §13 for what shipped and where it
diverged from this plan.

Outstanding manual step: `node backend/scripts/wipeLegacyCms.js` drops the
legacy collections. It refuses to run until the backup taken on 2026-08-04 is
three days old — so from **2026-08-07** onward.

---

## 1. Scope

A new Client Management System living in `frontendsales`, mounted in the `frontendall`
shell next to EMS and Task Management. It owns:

- The client registry (extending `TaskClient`, the one Task Management already uses)
- Per-client plans (GOLD / PLATINUM / DIAMOND)
- A per-client, per-month content calendar
- Scheduling of posts / reels / daily stories / festive stories
- A multi-stage approval workflow
- A month-end fulfilment report

It drives **client-type tasks only** in Task Management. Personal, team, and event
tasks are untouched.

---

## 2. Decisions locked in

| Topic | Decision |
|---|---|
| Old `frontendsales` UI | Deleted entirely, rebuilt from scratch |
| Old sales backend | Removed where exclusively sales-owned; modified where shared |
| Inventory module | Removed entirely (backend + frontend + nav) |
| Legacy Mongo data | Backed up, wiped after 3 days |
| Sales account | New `USER_ROLES.SALES`, seeded from `.env`, linked to a real Employee |
| Access helper | New `isCmsAdmin()` = admin \|\| sales. `isAdminLike()` untouched |
| HR | Read-only across the whole CMS |
| Employees | See only clients whose team they belong to |
| Timezone | IST (UTC+05:30) everywhere, always |
| Task dates | start = 1st of month 09:30 IST (or creation day if later); end = scheduled date 18:30 IST |
| Backfilling | Allowed — scheduling a past date is legal |
| Completion rule | A client task cannot be completed while any subtask is incomplete |
| Deliverable | A plain string field (link/reference), no file upload |
| Team roles | `WorkTeam.socialMediaManager` ref + per-member `roleInTeam`. `Employee.designation` untouched |
| Daily stories | No approval chain — single complete action |
| SMM = team leader | Both approval gates skip, straight to client |
| Rejection | Rejector picks how far back to send |
| Client rejection | Impossible once published |
| Emails | Suppressed for all client tasks; unchanged for personal/team/event |
| Denominator | Stored and displayed as a string (`"6-8"`); numerator is an integer |

---

## 3. Phase 0 — Demolition & migration (destructive)

### 3.1 Backup first

New script `backend/scripts/backupLegacyCms.js` — `mongodump`-style export of:

```
clients, quotations, quotationtemplates, clientnotes, clientactivitylogs,
clientchatmessages, clientdocumentrequests, clientuploadeddocuments,
meetings, tasks, taskcycles, teams, steplibraries,
inventoryitems, inventorycategories, inventorybookings
```

→ `backend/storage/backups/legacy-cms-<YYYY-MM-DD>/`

New script `backend/scripts/wipeLegacyCms.js` — refuses to run unless a backup
folder ≥ 3 days old exists. Run manually after the retention window.

**Preserve:** `frontendsales/public/*.pdf` — those are the GOLD / PLATINUM / DIAMOND
package documents and the source of truth for what each plan actually promises.
Move them to `backend/storage/` or keep them in the rebuilt `public/`.

### 3.2 Repoint the one remaining cross-dependency

`Event.client` currently refs `Client`. Since the CMS client registry becomes
`TaskClient`, repoint it:

- `backend/src/models/Event.js:23` → `ref: 'TaskClient'`
- `frontendall/src/api/clients.api.ts` → call `/task-clients` instead of `/clients`
- `frontendall/src/hooks/useClients.ts` → same
- `frontendall/src/components/events/EventFormDialog.tsx` → field names (`name` not `clientName`/`brandName`)
- Migration script: map existing `Event.client` ObjectIds to `TaskClient` by name match; unmatched → null, logged

The `listClientTasks` half of `clients.api.ts` disappears with Inventory.

### 3.3 Remove — Inventory

Backend: `InventoryItem`, `InventoryCategory`, `InventoryBooking` models,
`inventory.{routes,controller,validator}`, `inventoryItem/inventoryCategory/inventoryBooking.{service,repository}`,
the `/inventory` mount in `routes/index.js`, and `INVENTORY_*` constants.

Frontend (`frontendall`): `InventoryPage`, `InventoryItemDetailPage`,
`components/inventory/*`, `api/inventory.api.ts`, `hooks/useInventory.ts`,
the two `/inventory` routes in `App.tsx`, and the `ShellHomePage` tile.

### 3.4 Remove — sales-exclusive backend

Models: `Client`, `Quotation`, `QuotationTemplate`, `ClientNote`, `ClientActivityLog`,
`ClientChatMessage`, `ClientDocumentRequest`, `ClientUploadedDocument`, `Meeting`,
`Task`, `TaskCycle`, `Team`, `StepLibrary`

Plus their routes / controllers / services / repositories / validators,
`jobs/taskCycle.job.js`, `middlewares/clientAccess.middleware.js`,
`utils/clientAccess.js`, `websocket/clientChat.js`, and the
`seedQuotationTemplates` / `seedScopeOfWork` / `migrateQuotationFieldBoxes` scripts.

**Surgical, not wholesale:**
- `routes/public.routes.js` — strip only the quotation + client-document routes. The applicant Google Form webhook and EMS public upload stay.
- `routes/index.js` — remove the corresponding mounts.
- `models/Notification.js` — drop `client` and `task` refs.
- `config/constants.js` — remove `CLIENT_STATUS`, `QUOTATION_STATUS`, `TASK_STATUS`, `STEP_STATUS`, `APPROVAL_STATUS`, `DEFAULT_STEP_LIBRARY`, `INVENTORY_*`, and the 4 dead notification types (`TASK_ASSIGNED`, `STEP_OVERDUE`, `CYCLE_ENDING_SOON`, `CYCLE_ROLLOVER`).
- `utils/extraDetailsCrypto.js` — stays (Employee uses it too).
- `config/env.js` — `salesFrontendUrls` stays; the rebuilt app sits on the same origin.

One-off cleanup: delete existing `Notification` rows carrying the dead types.

### 3.5 Remove — `frontendsales/src` entirely

**Preserve the federation contract**, or the shell stops mounting the remote:

- `vite.config.ts` — `name: 'frontendsales'`, `exposes: { './App': './src/App.tsx' }`, port 5174, the `remote-style.css` asset name
- `scripts/fixRemoteEntry.cjs`
- `vercel.json`
- `package.json`, all `tsconfig.*`, `index.html`, `eslint.config.js`

Rebuilt from scratch, reusing the same patterns: `src/App.tsx`, `src/api/client.ts`,
`src/context/AuthContext.tsx`, `src/lib/authStorage.ts`, `src/components/ui/*`.

---

## 4. Access control

### 4.1 New role

`USER_ROLES.SALES = 'sales'` in `config/constants.js`.

`backend/scripts/seedUsers.js` gains:
```js
{ username: 'sales', password: requiredPassword('SEED_SALES_PASSWORD'), role: USER_ROLES.SALES }
```

The sales user gets a real `Employee` record and `employeeLink` set — without it,
`EmployeeTask.createdBy` is null and every `taskAccess` predicate returns false.

`isAdminLike()` is **not** touched. All 70 existing admin-gate call sites keep their
current behaviour.

### 4.2 New helper — `backend/src/utils/cmsAccess.js`

```
isCmsAdmin(user)            → admin || sales                  (full CRUD)
canReadCms(user)            → isCmsAdmin || hr || any employee (scoped below)
visibleClientIds(user)      → all for admin/sales/hr;
                              for a worker: TaskClients whose team they lead or belong to
canScheduleFor(user, item)  → isCmsAdmin || team leader
canApproveSmm(user, item)   → isCmsAdmin || employee === team.socialMediaManager
canApproveLead(user, item)  → isCmsAdmin || employee === team.leader
canMarkClientApproved(u,i)  → isCmsAdmin || team leader
canPublish(user, item)      → isCmsAdmin || team leader
```

HR passes every read gate and fails every write gate.

### 4.3 Permission matrix

| Action | admin | sales | hr | team lead | SMM | member |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| List / view clients | ✅ | ✅ | 👁 | own team | own team | own team |
| Create / edit / delete client | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set plan, create calendar | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Schedule / reschedule item | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Assign designer / shooter / editor | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Edit content brief | ✅ | ✅ | ❌ | ✅ | ✅ | assignee |
| SMM approval | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Lead approval | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Mark client-approved | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Mark published | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| View month-end report | ✅ | ✅ | 👁 | own team | own team | own team |

### 4.4 Frontend

- `RequireRole` (frontendall + frontendsales) accepts `'admin' | 'worker' | 'cms'`; `'cms'` → `admin || sales || hr`
- `ShellLayout` — add a **Client Management** nav item visible to admin / sales / hr / any employee on a team. Audit Log stays admin/HR only
- `ShellHomePage` — update the `/sales` tile description, drop the Inventory tile
- `frontendall/src/App.tsx` — `/sales/*` gate widens from `role="admin"` to `role="cms"`

**Note:** permissions are baked into the JWT at login. Granting the sales account a
permission later requires a re-login. Role-based gating (what we're using) has the
same constraint; team-leader checks do a live DB lookup and don't.

---

## 5. Data model

### 5.1 `TaskClient` — extended

```js
name              // existing, unique
logoUrl           // existing
defaultTeam       // existing → ref WorkTeam
isDeleted         // existing

brandName         // NEW
location: { addressLine, city, state, country, pincode }   // NEW
contacts: [{ name, role, email, phone, isPrimary }]        // NEW
currentPlan       // NEW — 'gold' | 'platinum' | 'diamond' | null
instagramHandle, website                                    // NEW, optional
```

`name` is `unique: true` today — duplicate registration will 409. Surface that as a
clean form error.

### 5.2 Plan constants

```js
CMS_PLAN: { GOLD: 'gold', PLATINUM: 'platinum', DIAMOND: 'diamond' },

CMS_PLAN_QUOTAS: {
  gold:     { posts: '6',   reels: '6',   dailyStories: '1',   festiveStories: '2'   },
  platinum: { posts: '6-8', reels: '6-8', dailyStories: '1-2', festiveStories: '2-4' },
  diamond:  { posts: '8',   reels: '8',   dailyStories: '2-3', festiveStories: '2-4' },
}
```

Denominators are strings, displayed verbatim. Numerators are integers.

### 5.3 `ClientCalendar` — one per client per month

```js
client        → TaskClient (required, index)
year, month   // month 1-12
plan          // SNAPSHOT of currentPlan at creation
quotas        // SNAPSHOT of CMS_PLAN_QUOTAS[plan]
team          → WorkTeam  // SNAPSHOT of defaultTeam, editable
createdBy     → Employee
closedAt, report                                  // see §9
isDeleted
```

Unique index `{ client, year, month }`.

Snapshotting means a plan change in March never rewrites February. This mirrors how
`TaskCycle` already pinned its quotation.

### 5.4 `CalendarItem` — one scheduled deliverable

```js
calendar       → ClientCalendar (required, index)
client         → TaskClient (denormalised for querying)
type           // 'post' | 'reel' | 'story' | 'festive_story'
index          // per calendar, per type → "POST #1". Resets each month
scheduledDate  // stored as the UTC instant of 18:30 IST on that day

brief: {
  postingName, postingLink, collabsAndTags, caption,
  uploadDestination,          // where it goes live
  deliverableLink             // the designer's output — plain string
}

assignments: { designer, shooter, editor }   // Employee refs

task           → EmployeeTask                // the top-level client task
subtaskRefs: { design, shoot, edit }         → EmployeeTask

gates          // SNAPSHOT at submit: { smm: bool, lead: bool }
stage          // see §6
isRejected     // true = work is owed at the current stage
lastRejection: { fromStage, sentBackTo, reason, by, at }
stageHistory: [{ from, to, action, byUser, byEmployee, note, at }]

publishedAt, publishedBy
isDeleted
```

### 5.5 `WorkTeam` — additive changes only

```js
socialMediaManager → Employee            // NEW, like `leader`
memberRoles: [{ employee, roleInTeam }]  // NEW, parallel to `members`
```

**Deliberately additive.** Changing `members` from `[ObjectId]` to a subdocument array
would break 7 backend sites and 8 frontend sites — including two raw Mongo queries
(`employeeTask.repository.js:117`, `workTeam.repository.js:43`) and
`taskAccess.js:43`, which gates access to *every* team/client/event task. The parallel
array costs nothing and touches only `WorkTeamFormDialog`.

This is the only change to `frontendfollowups`: the team form asks for each member's
role and for the team's Social Media Manager.

### 5.6 `EmployeeTask` — client-type additions

```js
cmsItem        → CalendarItem (index)     // set only on CMS-owned client tasks
cmsRole        // 'design' | 'shoot' | 'edit' | 'story'
blockedBy      → EmployeeTask             // edit is blocked by shoot
deliverableLink // String — the "just a string" output
```

Behaviour changes, scoped to `type === 'client'`:

1. **No emails.** Gate `sendTeamTaskAssignedEmail`, `sendSubtaskAssignedEmail`, and `sendTaskRejectedEmail` on `task.type !== CLIENT`. In-app notifications still fire.
2. **Parent completion is blocked** while any subtask is incomplete — `markCompleted` / `markCompletedDirect` reject with a clear message.
3. **`blockedBy` gating** — a task with an incomplete `blockedBy` cannot be started or marked for review.
4. **No direct creation.** `requireCanCreateTopLevelTask` rejects `type: 'client'` unless it originates from the CMS. Otherwise a team lead could create client work that bypasses the calendar and counts toward nothing.
5. **No direct deletion** of a CMS-owned client task — delete the calendar item instead, which cascades.

---

## 6. Workflow state machine

### 6.1 Stages

| Stage | Meaning | Colour |
|---|---|---|
| `scheduled` | Created, work not started | 🟠 Orange |
| `in_progress` | A subtask has moved off pending | 🔵 Blue |
| `awaiting_smm` | Work submitted, SMM to approve | 🟣 Purple |
| `awaiting_lead` | SMM approved | 🟦 Indigo |
| `awaiting_client` | Lead approved | 🟡 Amber |
| `client_approved` | Client signed off | 🟢 Green |
| `published` | Live — terminal | ✅ Dark green |
| — `isRejected: true` | Overrides the colour at any stage | 🔴 Red |
| — past due & unpublished | Overrides | ⚫ Grey outline |

Colours are placeholders — centralised in one constants file so you can swap them.

### 6.2 Gate resolution (snapshotted at submit time)

```
designer === socialMediaManager  → skip the SMM gate
designer === leader              → skip the lead gate
socialMediaManager === leader    → both gates skip (your call), straight to client
```

Snapshotting at submit means a roster change mid-review doesn't silently rewrite an
in-flight approval — same principle as the plan snapshot.

**Daily stories** (`type: 'story'`) bypass the chain entirely:
`scheduled → in_progress → published`.

### 6.3 Rejection

The rejector picks a target; options are stage-dependent:

| Rejecting at | Can send back to |
|---|---|
| `awaiting_smm` | designer (redo work) |
| `awaiting_lead` | designer, or SMM |
| `awaiting_client` | designer, SMM, or lead |
| `published` | ❌ not possible |

Rejection requires a reason. It sets `isRejected: true`, moves `stage` to the target,
reopens the relevant subtask(s), and logs to `stageHistory`. Once rejected the chain
**re-runs forward** from the target stage.

For reels (two doers), the rejector also picks which subtask reopens: shoot, edit, or
both.

A rejected item never counts toward the delivered numerator.

### 6.4 SMM unavailable

- `socialMediaManager` offboarded (`Employee.status !== 'active'`) → fall through to team leader → admin
- On leave → **admin and sales can act at any stage**, recorded as "approved by X on behalf of the SMM" in `stageHistory`
- Items sitting in `awaiting_smm` for > 24h surface on the admin/sales dashboard

---

## 7. Dates & timezone

Everything IST (UTC+05:30), constructed explicitly. **Never** `new Date(y, m, d, h)` —
the server runs UTC and that silently shifts every deadline by 5.5 hours.

New `backend/src/utils/istDate.js`:

```
IST_OFFSET_MINUTES = 330
istDayStart(date)              // 00:00 IST as a UTC instant
istAt(date, hh, mm)            // e.g. istAt(d, 18, 30)
istMonthRange(year, month)     // [start, end) for calendar queries
```

Task window for every CMS-created task and subtask:

```
startAt = max(1st of the month @ 09:30 IST, creation timestamp)
endAt   = scheduledDate @ 18:30 IST
```

Backfilling is allowed. When `scheduledDate` is in the past, `endAt < startAt` — that's
accepted deliberately, and the item is flagged as backfilled rather than blocked.

---

## 8. Calendar UI

- Full month grid, all dates of the selected month
- Each cell shows **only headings** — `POST #1`, `REEL #2`, `STORY`, `FESTIVE` — colour-coded by stage
- Clicking a day opens a **modal** with that day's full details; every item is expandable
- Right sidebar shows counters:

```
Posts             Scheduled 7 / 6-8   ·  Delivered 4 / 6-8
Reels             Scheduled 6 / 6-8   ·  Delivered 5 / 6-8
Daily stories     22 / 30 days covered
Festive stories   Scheduled 3 / 2-4   ·  Delivered 2 / 2-4
```

Both numbers shown because "scheduled" and "done" answer different questions —
a month where everything is scheduled and nothing is finished must not read as complete.
Numerators can exceed the denominator (`7 / 6-8` is fine).

- Scheduling modal captures: type, date, assignee(s), posting name, posting link,
  collabs + tags, caption, upload destination. All optional except type / date / assignee — fillable later.
- Rescheduling moves the parent task **and** every subtask window.
- Deleting an item soft-deletes the item, its task, and its subtasks together.

Client cards on the list page get a **Calendar** button that jumps straight to the
current month.

---

## 9. Month-end fulfilment report

One per client per month, **frozen** at month end (a cron on the 1st, or manual
"Close month") so later edits can't rewrite history. Stored on `ClientCalendar.report`.

Per content type: committed (the range string) · scheduled · delivered · on-time %.
Plus: rejection count by stage, average approval turnaround, and a list of items that
were never published.

Viewable by admin / sales / HR, and by the team for their own clients. Exportable.

---

## 10. Build order

| Phase | Work | Risk |
|---|---|---|
| **0** | Backup, remove Inventory, remove sales backend, repoint `Event`, wipe `frontendsales/src` | 🔴 Destructive |
| **1** | `sales` role, `cmsAccess.js`, seed script, `RequireRole`, shell nav | 🟢 |
| **2** | `istDate.js`, plan constants, extend `TaskClient`, `WorkTeam` additions | 🟢 |
| **3** | `ClientCalendar` + `CalendarItem` models, repos, services, routes | 🟡 |
| **4** | `EmployeeTask` client-type changes (email suppression, `blockedBy`, completion rule, creation guard) | 🟡 Touches shared code |
| **5** | Approval state machine + notifications | 🟡 |
| **6** | `frontendsales` rebuild — client list, client detail, calendar, day modal, scheduling | 🟢 |
| **7** | Month-end report + close-month cron | 🟢 |
| **8** | `frontendfollowups` — team form asks for member roles + SMM | 🟢 Minimal |

---

## 11. Confirm before Phase 0 runs

Phase 0 deletes code and (after 3 days) data. Three points worth a final yes:

1. **The quotation system is going away for good** — templates, PDF field mapper, scope-of-work editor, public client signing links. Any share link already sent to a client stops working. Confirmed?
2. **`Event.client` repoints to `TaskClient`**, and existing events get matched by name. Unmatched events lose their client link. Acceptable?
3. **Client contact data currently in the `Client` collection is not migrated** into the new `TaskClient` fields — you'd re-enter clients in the new CMS. Or should Phase 0 include a `Client → TaskClient` migration for name / brand / contacts?

## 13. What shipped, and where it diverged from this plan

Verified by a 52-assertion end-to-end test against a real database (fixtures
created and torn down per run), plus a clean typecheck and build of all four
frontends.

**Divergences, and why:**

1. **Daily stories are one item per *day*, not one per story.** Diamond's
   "2-3/day" would otherwise mean up to 90 tasks a month for one person per
   client. The plan commits a *rate*, and the spec calls daily stories "the
   daily task" — so a day is the unit of work and the day's expected count
   rides along as the quota label. Their counter reads "22 / 31 days covered".
2. **`EventResponsibility.assignedTeam` also had to be repointed** (to
   `WorkTeam`). It referenced the removed `Team` model, and `event.service.js`
   / `eventNotify.service.js` both called `team.repository` — Event Management
   would have broken. This wasn't in the plan; it surfaced during demolition.
   Fixing it also fixed a latent bug: team leaders were never notified of
   their own team's event responsibilities.
3. **`WorkTeam.members` was left alone.** `memberRoles` is a parallel array,
   as §5.5 argued for, so nothing in `taskAccess.js` or the two raw Mongo
   queries had to change.
4. **`frontendsales`' app shell was preserved** — `AuthContext`, `RequireAuth`,
   the axios client, the shadcn primitives, `LoginPage`. All CRM feature code
   is gone. Rebuilding byte-identical copies would only have let them drift
   from the other three frontends.
5. **`taskNotify.service.js` became `notifyRecipients.service.js`.** Most of it
   was old Task/TaskCycle notification templates; `eventNotify` depended only
   on its employee→user resolver, which survives under an honest name.
6. **SMM-is-leader collapses *both* gates.** The first implementation only
   dropped the SMM gate, leaving the same person to approve twice; the test
   caught it. Now it goes straight to the client, as specified.
7. **Inventory was removed entirely**, which also removed the
   `InventoryBooking.clientTask → Task` reference — the second of the two
   things tying `frontendall` to the old backend.

**Guards added so the calendar stays the source of truth:** client-type tasks
can't be created directly in Task Management, and a CMS-owned task can't be
deleted or have its dates edited there. Each error names the calendar as the
place to do it instead.

## 12. Assumptions made where you didn't specify

- Counters show **both** scheduled and delivered (§8)
- The **delivered** numerator counts `published`, not `client_approved`
- Plan quotas are **snapshotted** onto the calendar at creation (§5.3)
- Reel rejection lets the rejector pick which subtask reopens (§6.3)
- "No task completes until its subtasks do" applies to **client tasks only** — say the word and it goes global
- Publishing is marked by admin / sales / team lead
- A month with no calendar generates no daily stories — nothing is auto-created
