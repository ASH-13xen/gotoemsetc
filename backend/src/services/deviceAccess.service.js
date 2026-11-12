const ApiError = require('../utils/ApiError');
const DeviceAccount = require('../models/DeviceAccount');
const DeviceRunbook = require('../models/DeviceRunbook');
const DeviceSettings = require('../models/DeviceSettings');
const EmployeeAccess = require('../models/EmployeeAccess');
const Device = require('../models/Device');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const deviceService = require('./device.service');
const { encrypt, decrypt } = require('../utils/secretCrypto');
const { companyEmailOf } = require('../utils/companyEmail');
const { isSelf } = require('../utils/roles');
const { ACCOUNT_KINDS, ACCESS_DEVICE_TYPES, ACCESS_ITEM_KINDS, DEVICE_STATUS } = require('../utils/deviceCatalog');

// The access side of HR Work → Devices:
//  - the account register: every company account that lives on a device,
//    its 2-step setup and which devices it is on; passwords encrypted;
//  - the access matrix: per designation, what goes on each device type;
//  - each person's access checklist, built from that matrix;
//  - revoking someone: their EMS login off at once, then a runbook of every
//    device to take back, password to change and access to remove.

const nameOf = (e) => `${e?.firstName || ''} ${e?.lastName || ''}`.trim();
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

// ---------------------------------------------------------------- accounts

const ACCOUNT_FIELDS = ['kind', 'label', 'identifier', 'recoveryEmail', 'recoveryPhone', 'twoFactorOn', 'codesGoTo', 'devices', 'employee', 'notes'];

function accountFields(data) {
  const out = {};
  for (const key of ACCOUNT_FIELDS) if (data[key] !== undefined) out[key] = data[key] === '' ? null : data[key];
  if (out.kind && !ACCOUNT_KINDS[out.kind]) throw ApiError.badRequest('Unknown account kind');
  return out;
}

async function listAccounts({ kind, device, employee } = {}) {
  const filter = {};
  if (kind) filter.kind = kind;
  if (device) filter.devices = device;
  if (employee) filter.employee = employee;
  const accounts = await DeviceAccount.find(filter)
    .select('+password +pin')
    .sort({ kind: 1, identifier: 1 })
    .populate('devices', 'code brand model status')
    .populate('employee', 'firstName lastName')
    .populate('passwordChangedBy', 'username')
    .lean();
  // Whether a password / PIN is on file — never the value.
  return accounts.map(({ password, pin, ...rest }) => ({ ...rest, hasPassword: Boolean(password), hasPin: Boolean(pin) }));
}

async function createAccount(data, user) {
  const fields = accountFields(data);
  if (!fields.kind || !fields.identifier) throw ApiError.badRequest('Choose the kind of account and enter its email / number / handle');
  return DeviceAccount.create({
    ...fields,
    password: data.password ? encrypt(data.password) : undefined,
    pin: data.pin ? encrypt(data.pin) : undefined,
    passwordChangedAt: data.password ? new Date() : undefined,
    passwordChangedBy: data.password ? user.id : undefined,
  });
}

async function updateAccount(id, data, user) {
  const account = await DeviceAccount.findById(id);
  if (!account) throw ApiError.notFound('Account not found');
  Object.assign(account, accountFields(data));
  if (data.password) {
    account.password = encrypt(data.password);
    account.passwordChangedAt = new Date();
    account.passwordChangedBy = user.id;
  }
  if (data.pin) account.pin = encrypt(data.pin);
  await account.save();
  return account;
}

async function deleteAccount(id) {
  const account = await DeviceAccount.findByIdAndDelete(id);
  if (!account) throw ApiError.notFound('Account not found');
  return { deleted: true };
}

// The password and PIN in plain text, for the one person asking — logged by
// the route (audit) every time.
async function revealAccount(id) {
  const account = await DeviceAccount.findById(id).select('+password +pin').lean();
  if (!account) throw ApiError.notFound('Account not found');
  return { password: account.password ? decrypt(account.password) : null, pin: account.pin ? decrypt(account.pin) : null };
}

// ---------------------------------------------------------------- settings

async function updateSettings(data) {
  const settings = await deviceService.getSettings();
  if (Array.isArray(data.apps)) {
    const seen = new Set();
    settings.apps = data.apps
      .filter((a) => a && a.label)
      .map((a) => ({ key: a.key || slug(a.label), label: String(a.label).trim(), required: a.required !== false }))
      .filter((a) => !seen.has(a.key) && seen.add(a.key));
  }
  if (data.brand) {
    for (const key of ['whatsappName', 'bio', 'website', 'address']) if (data.brand[key] !== undefined) settings.brand[key] = data.brand[key];
  }
  for (const key of ['checkDueDay', 'lowStoragePct', 'lowBatteryPct']) if (data[key] !== undefined && data[key] !== '') settings[key] = Number(data[key]);
  if (Array.isArray(data.accessTemplates)) {
    settings.accessTemplates = data.accessTemplates
      .filter((t) => t && t.designation && ACCESS_DEVICE_TYPES[t.deviceType])
      .map((t) => ({
        designation: String(t.designation).trim(),
        deviceType: t.deviceType,
        items: (t.items || [])
          .filter((i) => i && i.label)
          .map((i) => ({ key: i.key || slug(`${i.kind || 'app'}_${i.label}`), kind: ACCESS_ITEM_KINDS[i.kind] ? i.kind : 'app', label: String(i.label).trim(), detail: i.detail || undefined })),
      }));
  }
  await settings.save();
  return settings;
}

async function setBrandFile(which, file, user) {
  if (!['logo', 'brochure'].includes(which)) throw ApiError.badRequest('Unknown brand file');
  if (!file) throw ApiError.badRequest('Choose the file');
  const settings = await deviceService.getSettings();
  settings.brand[which] = await deviceService.saveFile(file, 'brand', user);
  await settings.save();
  return settings;
}

// ---------------------------------------------------------------- access checklists

// The matrix rows for someone: everyone's ('*') plus their designation's.
function templateItemsFor(settings, designation) {
  const mine = String(designation || '').trim().toLowerCase();
  const rows = settings.accessTemplates.filter((t) => t.designation === '*' || t.designation.trim().toLowerCase() === mine);
  const items = [];
  for (const row of rows) for (const item of row.items) items.push({ ...item.toObject?.() ?? item, deviceType: row.deviceType });
  return items;
}

// Their checklist, brought up to date with the matrix: anything new in it is
// added (to do); what is already there is kept, done or not.
async function employeeAccess(employeeId) {
  const employee = await employeeRepository.findById(String(employeeId));
  if (!employee) throw ApiError.notFound('Employee not found');
  const settings = await deviceService.getSettings();
  let doc = await EmployeeAccess.findOne({ employee: employee._id });
  if (!doc) doc = new EmployeeAccess({ employee: employee._id, items: [] });
  const have = new Set(doc.items.map((i) => `${i.deviceType}:${i.key}`));
  let added = 0;
  for (const item of templateItemsFor(settings, employee.designation)) {
    if (have.has(`${item.deviceType}:${item.key}`)) continue;
    doc.items.push({ key: item.key, deviceType: item.deviceType, kind: item.kind, label: item.label, detail: item.detail, fromTemplate: true });
    added += 1;
  }
  if (added || doc.isNew) await doc.save();
  const [devices, accounts, runbooks] = await Promise.all([
    Device.find({ holder: employee._id, status: DEVICE_STATUS.ASSIGNED }).select('code kind brand model').lean(),
    DeviceAccount.find({ employee: employee._id }).select('kind identifier').lean(),
    DeviceRunbook.find({ employee: employee._id, kind: 'revoke' }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  return {
    employee: { _id: employee._id, name: nameOf(employee), designation: employee.designation, status: employee.status, companyEmail: companyEmailOf(employee) },
    items: doc.items,
    devices,
    accounts,
    runbooks,
  };
}

async function addAccessItem(employeeId, data) {
  if (!data.label || !ACCESS_DEVICE_TYPES[data.deviceType]) throw ApiError.badRequest('Give it a name and the device it is on');
  await employeeAccess(employeeId);
  const doc = await EmployeeAccess.findOne({ employee: employeeId });
  doc.items.push({
    key: `custom_${slug(data.label)}_${Date.now().toString(36)}`,
    deviceType: data.deviceType,
    kind: ACCESS_ITEM_KINDS[data.kind] ? data.kind : 'other',
    label: data.label,
    detail: data.detail,
    fromTemplate: false,
  });
  await doc.save();
  return employeeAccess(employeeId);
}

async function updateAccessItem(employeeId, itemId, { status, note }, user) {
  const doc = await EmployeeAccess.findOne({ employee: employeeId });
  const item = doc?.items.id(itemId);
  if (!item) throw ApiError.notFound('Item not found');
  if (status) {
    if (!['pending', 'done', 'na', 'revoked'].includes(status)) throw ApiError.badRequest('Unknown status');
    item.status = status;
    item.doneAt = status === 'pending' ? undefined : new Date();
    item.doneBy = status === 'pending' ? undefined : user.id;
  }
  if (note !== undefined) item.note = note;
  await doc.save();
  return employeeAccess(employeeId);
}

async function removeAccessItem(employeeId, itemId) {
  const doc = await EmployeeAccess.findOne({ employee: employeeId });
  const item = doc?.items.id(itemId);
  if (!item) throw ApiError.notFound('Item not found');
  item.deleteOne();
  await doc.save();
  return employeeAccess(employeeId);
}

// ---------------------------------------------------------------- revoke

// Cuts someone off: their EMS login goes off at once (that step is done as it
// starts), then every device they hold, every account tied to them or their
// devices, and every access item they were given becomes a step to tick.
async function startRevoke(employeeId, { reason }, user) {
  if (isSelf(user, employeeId)) throw ApiError.forbidden("You can't revoke your own access");
  const employee = await employeeRepository.findById(String(employeeId));
  if (!employee) throw ApiError.notFound('Employee not found');
  const open = await DeviceRunbook.findOne({ kind: 'revoke', employee: employee._id, status: 'open' });
  if (open) throw ApiError.conflict('A revoke for them is already open — finish that one');

  await userRepository.deactivateForEmployee(employee._id);
  const access = await employeeAccess(employee._id);
  const devices = await Device.find({ holder: employee._id, status: DEVICE_STATUS.ASSIGNED }).lean();
  const accounts = await DeviceAccount.find({ $or: [{ employee: employee._id }, { devices: { $in: devices.map((d) => d._id) } }] }).lean();
  const mail = companyEmailOf(employee);
  const now = new Date();
  const steps = [
    { key: 'ems', label: 'EMS login switched off', detail: 'Done the moment this revoke started — they are signed out of the EMS within a minute.', done: true, doneAt: now, doneBy: user.id },
    ...devices.map((d) => ({ key: `device:${d._id}`, label: `Take back ${d.code} (${[d.brand, d.model].filter(Boolean).join(' ') || d.kind})`, detail: 'Return it in HR Work → Devices, or mark it lost there if it is not coming back.' })),
    ...accounts.map((a) => ({
      key: `account:${a._id}`,
      account: a._id,
      label: `Change the password: ${ACCOUNT_KINDS[a.kind] || a.kind} — ${a.identifier}`,
      detail: 'Then sign out every other device (Google: Security → Your devices; Apple ID: Devices; WhatsApp: Linked devices) and update it here.',
    })),
    ...(mail ? [{ key: 'company_mail', label: `Company mail ${mail}: change the password and sign out every device`, detail: 'Or suspend the mailbox.' }] : []),
    ...access.items
      .filter((i) => i.status === 'done')
      .map((i) => ({ key: `access:${i._id}`, label: `Remove: ${i.label} (${ACCESS_DEVICE_TYPES[i.deviceType]})`, detail: i.detail || ACCESS_ITEM_KINDS[i.kind] })),
    { key: 'groups', label: 'Remove them from every company WhatsApp group', detail: 'Client groups included.' },
    { key: 'pages', label: 'Remove their roles on Instagram, Facebook, LinkedIn and Google Business pages', detail: 'And any shared drive or folder.' },
  ];
  return DeviceRunbook.create({ kind: 'revoke', employee: employee._id, reason, startedBy: user.id, steps });
}

async function listRunbooks({ status, kind } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (kind) filter.kind = kind;
  return DeviceRunbook.find(filter)
    .sort({ status: -1, createdAt: -1 })
    .limit(100)
    .populate('device', 'code brand model')
    .populate('employee', 'firstName lastName')
    .populate('startedBy steps.doneBy', 'username')
    .lean();
}

async function tickStep(runbookId, stepId, { done, note }, user, file) {
  const runbook = await DeviceRunbook.findById(runbookId);
  if (!runbook) throw ApiError.notFound('Runbook not found');
  const step = runbook.steps.id(stepId);
  if (!step) throw ApiError.notFound('Step not found');
  if (done !== undefined) {
    step.done = Boolean(done);
    step.doneAt = step.done ? new Date() : undefined;
    step.doneBy = step.done ? user.id : undefined;
  }
  if (note !== undefined) step.note = note;
  if (file) step.file = await deviceService.saveFile(file, step.key === 'police' ? 'police' : 'other', user);
  // A changed password is recorded on the account too.
  if (step.done && step.account) await DeviceAccount.updateOne({ _id: step.account }, { passwordChangedAt: new Date(), passwordChangedBy: user.id });
  // A removed access is marked on their checklist.
  if (step.key?.startsWith('access:') && runbook.employee) {
    await EmployeeAccess.updateOne(
      { employee: runbook.employee, 'items._id': step.key.slice(7) },
      { $set: { 'items.$.status': step.done ? 'revoked' : 'done' } }
    );
  }
  runbook.status = runbook.steps.every((s) => s.done) ? 'closed' : 'open';
  runbook.closedAt = runbook.status === 'closed' ? new Date() : undefined;
  await runbook.save();
  return runbook;
}

module.exports = {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  revealAccount,
  updateSettings,
  setBrandFile,
  employeeAccess,
  addAccessItem,
  updateAccessItem,
  removeAccessItem,
  startRevoke,
  listRunbooks,
  tickStep,
};
