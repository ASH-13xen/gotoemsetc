const fs = require('node:fs/promises');
const path = require('node:path');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const DeviceCheck = require('../models/DeviceCheck');
const DeviceFile = require('../models/DeviceFile');
const DeviceAccessory = require('../models/DeviceAccessory');
const DeviceAccount = require('../models/DeviceAccount');
const DeviceIssue = require('../models/DeviceIssue');
const DeviceRunbook = require('../models/DeviceRunbook');
const DeviceSettings = require('../models/DeviceSettings');
const FootageUpload = require('../models/FootageUpload');
const Employee = require('../models/Employee');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const counterRepository = require('../repositories/counter.repository');
const notificationService = require('./notification.service');
const { fillTemplate, renderPdfFromHtml } = require('./htmlRender.service');
const { companyEmailOf } = require('../utils/companyEmail');
const { isSelf } = require('../utils/roles');
const { NOTIFICATION_TYPES, EMPLOYEE_STATUS } = require('../config/constants');
const {
  DEVICE_KIND_PREFIX,
  DEVICE_STATUS,
  ASSIGNMENT_STATUS,
  CHECK_KIND,
  CHECK_STATUS,
  GRADES,
  GRADE_LABEL,
  PART_STATES,
  GENUINE_PARTS,
  GENUINE_STATES,
  PARTS,
  securityItemsFor,
  locationItemsFor,
  DEFAULT_APPS,
  ISSUE_CATEGORIES,
  ACCOUNT_KINDS,
  LOST_STEPS,
} = require('../utils/deviceCatalog');

// HR Work → Devices: every company device, who has it, what state it is in,
// whether it is set up safely, and what happens when it changes hands or goes
// missing. Accounts, the access matrix and revoking someone live in
// deviceAccess.service.js.
//
//   register  ->  hand over (handover check + accessories + agreement)
//             ->  holder confirms on their dashboard; monthly self-check, HR verifies
//             ->  returned (return check + receipt)  |  lost (runbook + recovery)
//   A device is checked once a month: a handover or return later in the same
//   month goes on that check (checksOfMonth) unless HR chooses to check again.
//   A leaver can't be settled (full & final) while they still hold a device,
//   and a lost / unreturned one is recovered there.

const nameOf = (e) => `${e?.firstName || ''} ${e?.lastName || ''}`.trim();
const deviceName = (d) => [d.brand, d.model].filter(Boolean).join(' ') || d.code;
const rupees = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const prettyDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—');
const num = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v));
// "2026-11" for a date, in India.
const monthKey = (d = new Date()) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 7);
const istDay = (d = new Date()) => new Date(new Date(d).getTime() + 330 * 60000).getUTCDate();
const HOLDER_POPULATE = { path: 'holder', select: 'firstName lastName employeeCode designation status' };

// ---------------------------------------------------------------- settings

async function getSettings() {
  let settings = await DeviceSettings.findOne({ key: 'main' });
  if (!settings) return DeviceSettings.create({ key: 'main', apps: DEFAULT_APPS, appDefaultsSeen: DEFAULT_APPS.map((a) => a.key) });
  // A default app added since (e.g. Google Contacts) joins the list once.
  const seen = new Set(settings.appDefaultsSeen?.length ? settings.appDefaultsSeen : settings.apps.map((a) => a.key));
  const fresh = DEFAULT_APPS.filter((a) => !seen.has(a.key));
  if (fresh.length || !settings.appDefaultsSeen?.length) {
    const have = new Set(settings.apps.map((a) => a.key));
    for (const app of fresh) if (!have.has(app.key)) settings.apps.push(app);
    settings.appDefaultsSeen = [...new Set([...seen, ...DEFAULT_APPS.map((a) => a.key)])];
    await settings.save();
  }
  return settings;
}

// ---------------------------------------------------------------- files

async function saveFile(file, kind, user) {
  if (!file) return null;
  const saved = await DeviceFile.create({
    kind,
    data: file.buffer,
    contentType: file.mimetype,
    filename: file.originalname,
    size: file.size,
    uploadedBy: user?.id,
  });
  return saved._id;
}

// HR sees every file; anyone signed in sees the brand kit (they set their
// WhatsApp profile from it); a holder sees the photos of their own checks.
async function getFile(id, viewer, { hr }) {
  const file = await DeviceFile.findById(id).select('+data');
  if (!file) throw ApiError.notFound('File not found');
  if (!hr && file.kind !== 'brand') {
    const check = await DeviceCheck.findOne({ photos: file._id }).select('employee');
    if (!check || !isSelf(viewer, check.employee)) throw ApiError.forbidden();
  }
  return file;
}

// ---------------------------------------------------------------- checks

// What stood out in a check: low storage, a weak battery, damage, a security
// setting off, a required app missing.
function flagsFor(check, kind, settings) {
  const flags = [];
  const total = Number(check.storageTotalGb);
  const free = Number(check.storageFreeGb);
  if (total > 0 && free >= 0 && (free / total) * 100 < settings.lowStoragePct) flags.push('low_storage');
  if (Number(check.batteryHealth) > 0 && Number(check.batteryHealth) < settings.lowBatteryPct) flags.push('battery_low');
  const parts = check.parts instanceof Map ? Object.fromEntries(check.parts) : check.parts || {};
  if (Object.values(parts).some((s) => s === 'damaged' || s === 'missing')) flags.push('damaged');
  const security = check.security instanceof Map ? Object.fromEntries(check.security) : check.security || {};
  if (securityItemsFor(kind).some((s) => security[s.key] === false)) flags.push('security_off');
  const location = check.location instanceof Map ? Object.fromEntries(check.location) : check.location || {};
  if (locationItemsFor(kind).some((s) => location[s.key] === false)) flags.push('location_off');
  if (kind === 'phone' || kind === 'tablet') {
    const required = settings.apps.filter((a) => a.required).map((a) => a.key);
    const byKey = new Map((check.apps || []).map((a) => [a.key, a]));
    if (required.some((k) => !byKey.get(k)?.installed || !byKey.get(k)?.loggedIn)) flags.push('apps_missing');
  }
  if (check.grade === 'D') flags.push('needs_repair');
  const genuine = check.genuine instanceof Map ? Object.fromEntries(check.genuine) : check.genuine || {};
  if (Object.values(genuine).includes('unknown')) flags.push('unknown_part');
  return flags;
}

// The check's findings, copied onto the device for the register.
async function applyCheckToDevice(device, check, settings) {
  const parts = check.parts instanceof Map ? Object.fromEntries(check.parts) : check.parts || {};
  const security = check.security instanceof Map ? Object.fromEntries(check.security) : check.security || {};
  const genuine = check.genuine instanceof Map ? Object.fromEntries(check.genuine) : check.genuine || {};
  const location = check.location instanceof Map ? Object.fromEntries(check.location) : check.location || {};
  const total = Number(check.storageTotalGb);
  const free = Number(check.storageFreeGb);
  const required = settings.apps.filter((a) => a.required).map((a) => a.key);
  const byKey = new Map((check.apps || []).map((a) => [a.key, a]));
  device.lastCheck = check._id;
  device.condition = {
    grade: check.grade || device.condition?.grade || null,
    storageFreePct: total > 0 && free >= 0 ? Math.round((free / total) * 100) : device.condition?.storageFreePct,
    batteryHealth: num(check.batteryHealth) ?? device.condition?.batteryHealth,
    damaged: Object.entries(parts).filter(([, s]) => s === 'damaged' || s === 'missing').map(([k]) => k),
    securityOff: securityItemsFor(device.kind).filter((s) => security[s.key] === false).map((s) => s.key),
    appsMissing: device.kind === 'phone' || device.kind === 'tablet' ? required.filter((k) => !byKey.get(k)?.installed || !byKey.get(k)?.loggedIn) : [],
    unknownParts: Object.entries(genuine).filter(([, s]) => s === 'unknown').map(([k]) => k),
    locationOff: locationItemsFor(device.kind).filter((s) => location[s.key] === false).map((s) => s.key),
    at: check.createdAt || new Date(),
  };
  if (check.apps?.length) device.apps = check.apps;
  await device.save();
}

// A check's fields from what the screen sent (JSON), kept to what is known.
function checkFields(device, input = {}) {
  const parts = {};
  for (const part of PARTS[device.kind] || PARTS.other) {
    const state = input.parts?.[part.key];
    if (state && PART_STATES.includes(state)) parts[part.key] = state;
  }
  const security = {};
  for (const item of securityItemsFor(device.kind)) {
    if (typeof input.security?.[item.key] === 'boolean') security[item.key] = input.security[item.key];
  }
  const location = {};
  for (const item of locationItemsFor(device.kind)) {
    if (typeof input.location?.[item.key] === 'boolean') location[item.key] = input.location[item.key];
  }
  // Only an iPhone shows which parts are genuine.
  const genuine = {};
  if (device.os === 'ios') {
    for (const part of GENUINE_PARTS) {
      const state = input.genuine?.[part.key];
      if (GENUINE_STATES.includes(state)) genuine[part.key] = state;
    }
  }
  const apps = Array.isArray(input.apps)
    ? input.apps
        .filter((a) => a && typeof a.key === 'string')
        .map((a) => ({ key: a.key, installed: Boolean(a.installed), loggedIn: Boolean(a.loggedIn), account: a.account ? String(a.account).slice(0, 120) : undefined }))
    : [];
  return {
    grade: GRADES.includes(input.grade) ? input.grade : null,
    parts,
    storageTotalGb: num(input.storageTotalGb) ?? device.storageGb,
    storageFreeGb: num(input.storageFreeGb),
    batteryHealth: num(input.batteryHealth),
    security,
    location,
    genuine,
    apps,
    galleryBackedUp: typeof input.galleryBackedUp === 'boolean' ? input.galleryBackedUp : undefined,
    remarks: input.remarks ? String(input.remarks).slice(0, 2000) : undefined,
  };
}

async function recordCheck(device, { kind, input, photos = [], user, byHolder = false, assignment = null }) {
  const settings = await getSettings();
  const fields = checkFields(device, input);
  if (!fields.grade) throw ApiError.badRequest('Choose the overall condition (A–D)');
  const photoIds = [];
  for (const photo of photos.slice(0, 8)) {
    // eslint-disable-next-line no-await-in-loop
    photoIds.push(await saveFile(photo, 'photo', user));
  }
  const check = await DeviceCheck.create({
    ...fields,
    device: device._id,
    assignment: assignment?._id || device.assignment || null,
    employee: assignment?.employee || device.holder || null,
    kind,
    status: byHolder ? CHECK_STATUS.SUBMITTED : CHECK_STATUS.VERIFIED,
    by: user?.id,
    byHolder,
    reviewedBy: byHolder ? undefined : user?.id,
    reviewedAt: byHolder ? undefined : new Date(),
    month: kind === CHECK_KIND.MONTHLY ? monthKey() : undefined,
    photos: photoIds,
    flags: flagsFor(fields, device.kind, settings),
  });
  await applyCheckToDevice(device, check, settings);
  return check;
}

// ---------------------------------------------------------------- register

async function accessoryStock() {
  const [accessories, active] = await Promise.all([
    DeviceAccessory.find().sort({ name: 1 }).lean(),
    DeviceAssignment.find({ status: ASSIGNMENT_STATUS.ACTIVE, 'accessories.0': { $exists: true } }).select('accessories').lean(),
  ]);
  const out = new Map();
  for (const a of active) for (const item of a.accessories) {
    const key = String(item.accessory);
    out.set(key, (out.get(key) || 0) + Math.max(0, (item.qty || 0) - (item.returnedQty || 0)));
  }
  return accessories.map((a) => ({ ...a, out: out.get(String(a._id)) || 0, inStock: Math.max(0, (a.totalQty || 0) - (out.get(String(a._id)) || 0)) }));
}

// A device handed over this month already had its condition recorded at
// the handover: its first monthly check is next month's.
async function handedOverThisMonth(devices) {
  const ids = devices.map((d) => d.assignment).filter(Boolean);
  if (!ids.length) return new Set();
  const month = monthKey();
  const active = await DeviceAssignment.find({ _id: { $in: ids } }).select('device assignedAt').lean();
  return new Set(active.filter((a) => monthKey(a.assignedAt) === month).map((a) => String(a.device)));
}

// This month's check per device: the latest that isn't rejected.
async function monthChecks(deviceIds) {
  const checks = await DeviceCheck.find({ device: { $in: deviceIds }, kind: CHECK_KIND.MONTHLY, month: monthKey(), status: { $ne: CHECK_STATUS.REJECTED } })
    .select('device status createdAt')
    .lean();
  return new Map(checks.map((c) => [String(c.device), c]));
}

// HR checks a device once a month. Its check this month is the latest verified
// one since the 1st (in India): HR's own (a handover, a return, "Check now")
// or the holder's monthly check once HR verified it. A handover or a return
// later in the month uses it instead of asking for another, and it counts as
// the holder's monthly check too.
const monthStart = () => new Date(`${monthKey()}-01T00:00:00+05:30`);
const MONTH_CHECK_FIELDS = 'device kind grade flags createdAt byHolder by employee';

async function checksOfMonth(deviceIds) {
  const checks = await DeviceCheck.find({ device: { $in: deviceIds }, status: CHECK_STATUS.VERIFIED, createdAt: { $gte: monthStart() } })
    .sort({ createdAt: -1 })
    .select(MONTH_CHECK_FIELDS)
    .populate('by', 'username')
    .populate('employee', 'firstName lastName')
    .lean();
  const out = new Map();
  for (const c of checks) if (!out.has(String(c.device))) out.set(String(c.device), c);
  return out;
}

async function checkOfMonth(deviceId) {
  return DeviceCheck.findOne({ device: deviceId, status: CHECK_STATUS.VERIFIED, createdAt: { $gte: monthStart() } }).sort({ createdAt: -1 });
}

async function list({ status, kind, q } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (kind) filter.kind = kind;
  if (q) {
    const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ code: re }, { brand: re }, { model: re }, { imei1: re }, { imei2: re }, { serialNumber: re }, { simNumber: re }, { modelNumber: re }, { iccid: re }, { eid: re }, { meid: re }];
  }
  const [devices, settings] = await Promise.all([Device.find(filter).populate(HOLDER_POPULATE).sort({ code: 1 }).lean(), getSettings()]);
  const ids = devices.map((d) => d._id);
  const [checks, fresh, done] = await Promise.all([monthChecks(ids), handedOverThisMonth(devices), checksOfMonth(ids)]);
  const pastDue = istDay() > settings.checkDueDay;
  return devices.map((d) => {
    const check = checks.get(String(d._id));
    const checkThisMonth = done.get(String(d._id)) || null;
    const newThisMonth = d.status === DEVICE_STATUS.ASSIGNED && fresh.has(String(d._id));
    return {
      ...d,
      monthCheck: check ? check.status : null,
      checkThisMonth,
      newThisMonth,
      checkOverdue: d.status === DEVICE_STATUS.ASSIGNED && !check && !checkThisMonth && !newThisMonth && pastDue,
    };
  });
}

async function summary() {
  const [byStatus, byKind, stock, toVerify, openIssues, openRunbooks, all, footageToVerify] = await Promise.all([
    Device.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Device.aggregate([{ $match: { status: { $ne: DEVICE_STATUS.RETIRED } } }, { $group: { _id: { kind: '$kind', status: '$status' }, n: { $sum: 1 } } }]),
    accessoryStock(),
    DeviceCheck.countDocuments({ status: CHECK_STATUS.SUBMITTED }),
    DeviceIssue.countDocuments({ status: 'open' }),
    DeviceRunbook.countDocuments({ status: 'open' }),
    list({ status: DEVICE_STATUS.ASSIGNED }),
    FootageUpload.countDocuments({ verifiedAt: null }),
  ]);
  const counts = Object.fromEntries(Object.values(DEVICE_STATUS).map((s) => [s, 0]));
  for (const row of byStatus) counts[row._id] = row.n;
  const kinds = {};
  for (const row of byKind) {
    kinds[row._id.kind] = kinds[row._id.kind] || { total: 0, available: 0, assigned: 0 };
    kinds[row._id.kind].total += row.n;
    if (row._id.status === DEVICE_STATUS.AVAILABLE) kinds[row._id.kind].available += row.n;
    if (row._id.status === DEVICE_STATUS.ASSIGNED) kinds[row._id.kind].assigned += row.n;
  }
  return {
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0) - counts.retired,
    kinds,
    accessories: stock,
    checksToVerify: toVerify,
    footageToVerify,
    checksOverdue: all.filter((d) => d.checkOverdue).length,
    openIssues,
    openRunbooks,
    flagged: all.filter((d) => (d.condition?.damaged?.length || 0) + (d.condition?.securityOff?.length || 0) > 0 || (d.condition?.storageFreePct ?? 100) < 15).length,
  };
}

const EDITABLE = ['brand', 'model', 'modelNumber', 'os', 'osVersion', 'color', 'imei1', 'imei2', 'meid', 'iccid', 'eid', 'serialNumber', 'storageGb', 'simNumber', 'simProvider', 'purchaseDate', 'purchasePrice', 'recoveryValue', 'vendor', 'warrantyUntil', 'notes'];
function editable(data) {
  const out = {};
  for (const key of EDITABLE) {
    if (data[key] === undefined) continue;
    out[key] = data[key] === '' ? null : data[key];
  }
  return out;
}

async function create(data, user) {
  const kind = data.kind;
  if (!DEVICE_KIND_PREFIX[kind]) throw ApiError.badRequest('Choose what kind of device it is');
  for (const field of ['imei1', 'serialNumber']) {
    if (data[field]) {
      // eslint-disable-next-line no-await-in-loop
      const clash = await Device.findOne({ [field]: data[field] }).select('code');
      if (clash) throw ApiError.conflict(`${clash.code} already has this ${field === 'imei1' ? 'IMEI' : 'serial number'}`);
    }
  }
  const seq = await counterRepository.nextSequence(`device-${kind}`);
  const fields = editable(data);
  const device = await Device.create({
    ...fields,
    kind,
    code: `${DEVICE_KIND_PREFIX[kind]}-${String(seq).padStart(3, '0')}`,
    recoveryValue: fields.recoveryValue ?? fields.purchasePrice ?? undefined,
    createdBy: user?.id,
  });
  return device;
}

async function update(id, data) {
  const device = await Device.findById(id);
  if (!device) throw ApiError.notFound('Device not found');
  Object.assign(device, editable(data));
  await device.save();
  return device;
}

async function loadDevice(id) {
  const device = await Device.findById(id);
  if (!device) throw ApiError.notFound('Device not found');
  return device;
}

async function detail(id) {
  const device = await Device.findById(id).populate(HOLDER_POPULATE).populate('locationVerified.by', 'username').lean();
  if (!device) throw ApiError.notFound('Device not found');
  const [assignments, checks, issues, accounts, runbooks, footage, settings, done] = await Promise.all([
    DeviceAssignment.find({ device: id })
      .sort({ assignedAt: -1 })
      .populate('employee', 'firstName lastName employeeCode designation status')
      .populate('assignedBy returnedTo', 'username')
      .lean(),
    DeviceCheck.find({ device: id }).sort({ createdAt: -1 }).limit(60).populate('employee', 'firstName lastName').populate('by reviewedBy', 'username').lean(),
    DeviceIssue.find({ device: id }).sort({ createdAt: -1 }).populate('employee', 'firstName lastName').lean(),
    DeviceAccount.find({ devices: id }).lean(),
    DeviceRunbook.find({ device: id }).sort({ createdAt: -1 }).populate('device', 'code brand model').populate('employee', 'firstName lastName').populate('startedBy steps.doneBy', 'username').lean(),
    FootageUpload.find({ device: id }).sort({ createdAt: -1 }).limit(30).populate(FOOTAGE_POPULATE).lean(),
    getSettings(),
    checksOfMonth([device._id]),
  ]);
  device.checkThisMonth = done.get(String(device._id)) || null;
  return { device, assignments, checks, issues, accounts, runbooks, footage, apps: settings.apps };
}

// ---------------------------------------------------------------- handover

function handoverSteps(device, employee) {
  const mail = companyEmailOf(employee);
  const steps = [
    { key: 'company_mail', label: `Add ${employee.firstName}'s company mail${mail ? ` (${mail})` : ''}` },
    { key: 'apps', label: 'Every required app installed and signed in to the company accounts' },
    { key: 'security', label: 'Screen lock and theft protection on — on the company account' },
    {
      key: 'location',
      label:
        device.kind === 'phone' || device.kind === 'tablet'
          ? 'Location: Find My on, and Google Maps location sharing with the company account (then verify it on the map)'
          : 'Location: Find My on, signed in to the company account',
    },
  ];
  if (device.kind === 'phone') {
    steps.push({ key: 'whatsapp_profile', label: 'WhatsApp Business profile from the brand kit (name, bio, logo, brochure)' });
    steps.push({ key: 'truecaller', label: 'Truecaller name updated' });
  }
  return steps;
}

async function stockCheck(requested) {
  const stock = new Map((await accessoryStock()).map((a) => [String(a._id), a]));
  const out = [];
  for (const item of requested || []) {
    const qty = Math.max(0, Math.floor(Number(item.qty) || 0));
    if (!qty) continue;
    const accessory = stock.get(String(item.accessory));
    if (!accessory) throw ApiError.badRequest('An accessory was not found');
    if (accessory.inStock < qty) throw ApiError.conflict(`Only ${accessory.inStock} × ${accessory.name} in stock`);
    out.push({ accessory: accessory._id, label: accessory.name, qty });
  }
  return out;
}

// The check a handover or return goes on: a new one when HR filled one in,
// otherwise the device's check this month (HR checks once a month).
async function checkToUse(device, input) {
  if (input?.grade) return null;
  const done = await checkOfMonth(device._id);
  if (!done) throw ApiError.badRequest(`${device.code} hasn't been checked this month — check it: choose the overall condition (A–D)`);
  return done;
}

async function assign(id, { employeeId, accessories, check }, user, photos = []) {
  const device = await loadDevice(id);
  if (device.status !== DEVICE_STATUS.AVAILABLE) throw ApiError.conflict(`${device.code} is ${device.status}, not available to hand over`);
  const employee = await employeeRepository.findById(String(employeeId));
  if (!employee || employee.status !== EMPLOYEE_STATUS.ACTIVE) throw ApiError.badRequest('Choose an active employee');
  const items = await stockCheck(accessories);
  const monthCheck = await checkToUse(device, check);

  const assignment = await DeviceAssignment.create({
    device: device._id,
    employee: employee._id,
    assignedBy: user.id,
    accessories: items,
    setupSteps: handoverSteps(device, employee),
  });
  device.status = DEVICE_STATUS.ASSIGNED;
  device.holder = employee._id;
  device.assignment = assignment._id;
  await device.save();
  const handover = monthCheck || (await recordCheck(device, { kind: CHECK_KIND.HANDOVER, input: check, photos, user, assignment }));
  assignment.handoverCheck = handover._id;
  await assignment.save();

  const holderUser = await userRepository.findByEmployeeId(employee._id);
  if (holderUser) {
    await notificationService.createForUsers([holderUser._id], {
      type: NOTIFICATION_TYPES.DEVICE_ASSIGNED,
      title: `${deviceName(device)} (${device.code}) handed over to you`,
      message: 'Check it and confirm you have it, as described, under "My devices" on your dashboard.',
      employee: employee._id,
    });
  }
  return assignment;
}

async function activeAssignment(device) {
  const assignment = device.assignment ? await DeviceAssignment.findById(device.assignment) : null;
  if (!assignment || assignment.status !== ASSIGNMENT_STATUS.ACTIVE) throw ApiError.conflict(`${device.code} is not with anyone`);
  return assignment;
}

async function returnDevice(id, { check, accessoriesReturned, note, toRepair }, user, photos = []) {
  const device = await loadDevice(id);
  const assignment = await activeAssignment(device);
  const monthCheck = await checkToUse(device, check);
  const returned = new Map((accessoriesReturned || []).map((a) => [String(a.accessory), Math.max(0, Math.floor(Number(a.qty) || 0))]));
  let missingValue = 0;
  const unitValues = new Map((await DeviceAccessory.find({ _id: { $in: assignment.accessories.map((a) => a.accessory) } }).lean()).map((a) => [String(a._id), a.unitValue || 0]));
  for (const item of assignment.accessories) {
    item.returnedQty = Math.min(item.qty, returned.has(String(item.accessory)) ? returned.get(String(item.accessory)) : item.qty);
    missingValue += (item.qty - item.returnedQty) * (unitValues.get(String(item.accessory)) || 0);
  }
  const back = monthCheck || (await recordCheck(device, { kind: CHECK_KIND.RETURN, input: check, photos, user, assignment }));
  const employee = await employeeRepository.findById(String(assignment.employee));
  assignment.status = ASSIGNMENT_STATUS.RETURNED;
  assignment.returnedAt = new Date();
  assignment.returnedTo = user.id;
  assignment.returnNote = note || undefined;
  assignment.returnCheck = back._id;
  assignment.setupSteps.push({ key: 'remove_company_mail', label: `Remove ${employee?.firstName || 'their'}'s company mail and any personal logins` });
  if (missingValue > 0) {
    assignment.recoveryAmount = missingValue;
    assignment.recoveryNote = 'Accessories not returned';
  }
  await assignment.save();
  device.status = toRepair || back.grade === 'D' ? DEVICE_STATUS.REPAIR : DEVICE_STATUS.AVAILABLE;
  device.holder = null;
  device.assignment = null;
  await device.save();
  return assignment;
}

async function markLost(id, { note }, user) {
  const device = await loadDevice(id);
  if ([DEVICE_STATUS.LOST, DEVICE_STATUS.RETIRED].includes(device.status)) throw ApiError.conflict(`${device.code} is already ${device.status}`);
  let assignment = null;
  if (device.status === DEVICE_STATUS.ASSIGNED) {
    assignment = await activeAssignment(device);
    const unitValues = new Map((await DeviceAccessory.find({ _id: { $in: assignment.accessories.map((a) => a.accessory) } }).lean()).map((a) => [String(a._id), a.unitValue || 0]));
    const accessoriesValue = assignment.accessories.reduce((t, a) => t + (a.qty - (a.returnedQty || 0)) * (unitValues.get(String(a.accessory)) || 0), 0);
    assignment.status = ASSIGNMENT_STATUS.LOST;
    assignment.lostAt = new Date();
    assignment.lostNote = note || undefined;
    assignment.recoveryAmount = (device.recoveryValue ?? device.purchasePrice ?? 0) + accessoriesValue;
    await assignment.save();
  }
  const accounts = await DeviceAccount.find({ devices: device._id }).lean();
  const steps = LOST_STEPS.map((s) => ({ key: s.key, label: s.label, detail: s.detail }));
  const passwordsAt = steps.findIndex((s) => s.key === 'passwords');
  steps.splice(
    passwordsAt + 1,
    0,
    ...accounts.map((a) => ({
      key: `account:${a._id}`,
      label: `Change the password: ${ACCOUNT_KINDS[a.kind] || a.kind} — ${a.identifier}`,
      detail: 'And sign the lost device out of it.',
      account: a._id,
    }))
  );
  if (!assignment) steps.splice(steps.findIndex((s) => s.key === 'recovery'), 1);
  const runbook = await DeviceRunbook.create({
    kind: 'lost',
    device: device._id,
    employee: assignment?.employee || null,
    reason: note || undefined,
    startedBy: user.id,
    steps,
  });
  device.status = DEVICE_STATUS.LOST;
  device.lostAt = new Date();
  device.holder = null;
  device.assignment = null;
  await device.save();
  return runbook;
}

// Found again: back in stock. What was owed for it is waived unless already settled.
async function markFound(id, user) {
  const device = await loadDevice(id);
  if (device.status !== DEVICE_STATUS.LOST) throw ApiError.conflict(`${device.code} is not lost`);
  device.status = DEVICE_STATUS.AVAILABLE;
  device.lostAt = undefined;
  await device.save();
  await DeviceAssignment.updateMany(
    { device: device._id, status: ASSIGNMENT_STATUS.LOST, recoverySettledIn: null, recoveryWaivedAt: null },
    { recoveryWaivedBy: user.id, recoveryWaivedAt: new Date(), recoveryNote: 'Device found' }
  );
  return device;
}

// A device added by mistake: only while it has no history at all (never
// handed over, checked, reported or logged against). Anything with a history
// is retired instead, so the record is kept.
async function remove(id) {
  const device = await loadDevice(id);
  const [assignments, checks, issues, runbooks, footage] = await Promise.all([
    DeviceAssignment.countDocuments({ device: device._id }),
    DeviceCheck.countDocuments({ device: device._id }),
    DeviceIssue.countDocuments({ device: device._id }),
    DeviceRunbook.countDocuments({ device: device._id }),
    FootageUpload.countDocuments({ device: device._id }),
  ]);
  if (assignments + checks + issues + runbooks + footage > 0) {
    throw ApiError.conflict(`${device.code} has a history — retire it instead, so its record is kept`);
  }
  await DeviceAccount.updateMany({ devices: device._id }, { $pull: { devices: device._id } });
  await device.deleteOne();
  return device;
}

async function setStatus(id, status) {
  const device = await loadDevice(id);
  const allowed = {
    [DEVICE_STATUS.REPAIR]: [DEVICE_STATUS.AVAILABLE],
    [DEVICE_STATUS.AVAILABLE]: [DEVICE_STATUS.REPAIR],
    [DEVICE_STATUS.RETIRED]: [DEVICE_STATUS.AVAILABLE, DEVICE_STATUS.REPAIR, DEVICE_STATUS.LOST],
  };
  if (!allowed[status]?.includes(device.status)) throw ApiError.conflict(`${device.code} can't go from ${device.status} to ${status}`);
  device.status = status;
  if (status === DEVICE_STATUS.RETIRED) device.retiredAt = new Date();
  await device.save();
  return device;
}

async function setStepDone(assignmentId, key, done, user) {
  const assignment = await DeviceAssignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Handover not found');
  const step = assignment.setupSteps.find((s) => s.key === key);
  if (!step) throw ApiError.notFound('Step not found');
  step.doneAt = done ? new Date() : undefined;
  step.doneBy = done ? user.id : undefined;
  await assignment.save();
  return assignment;
}

async function waiveRecovery(assignmentId, note, user) {
  const assignment = await DeviceAssignment.findById(assignmentId);
  if (!assignment?.recoveryAmount) throw ApiError.notFound('Nothing to recover on this handover');
  if (assignment.recoverySettledIn) throw ApiError.conflict('Already recovered in their full & final');
  assignment.recoveryWaivedBy = user.id;
  assignment.recoveryWaivedAt = new Date();
  assignment.recoveryNote = note || assignment.recoveryNote;
  await assignment.save();
  return assignment;
}

// ---------------------------------------------------------------- paperwork

const OS_LABEL = { android: 'Android', ios: 'iOS', windows: 'Windows', macos: 'macOS', other: 'Other' };
const PART_STATE_LABEL = { ok: 'OK', worn: 'Worn', damaged: 'Damaged', missing: 'Missing' };

async function documentData(assignment) {
  const [device, employee, check] = await Promise.all([
    Device.findById(assignment.device).lean(),
    Employee.findById(assignment.employee).lean(),
    DeviceCheck.findById(assignment.status === ASSIGNMENT_STATUS.RETURNED ? assignment.returnCheck : assignment.handoverCheck).lean(),
  ]);
  const accounts = await DeviceAccount.find({ devices: device._id }).lean();
  const parts = check?.parts || {};
  const security = check?.security || {};
  const location = check?.location || {};
  return {
    companyName: env.companyName || 'GO-TO Friend Pvt. Ltd.',
    employeeName: nameOf(employee),
    employeeCode: employee?.employeeCode || '—',
    designation: employee?.designation || '—',
    department: employee?.department || '—',
    issueDate: prettyDate(assignment.assignedAt),
    returnDate: prettyDate(assignment.returnedAt),
    deviceCode: device.code,
    deviceName: deviceName(device),
    deviceKind: device.kind,
    os: [OS_LABEL[device.os] || device.os, device.osVersion].filter(Boolean).join(' ') || '—',
    imei: [device.imei1, device.imei2].filter(Boolean).join(' / ') || '—',
    serialNumber: device.serialNumber || '—',
    color: device.color || '—',
    storage: device.storageGb ? `${device.storageGb} GB` : '—',
    simProvider: device.simProvider || '—',
    simNumber: device.simNumber || '—',
    recoveryValue: rupees(device.recoveryValue ?? device.purchasePrice ?? 0),
    grade: check?.grade ? `${check.grade} — ${GRADE_LABEL[check.grade]}` : '—',
    storageFree: check?.storageFreeGb != null ? `${check.storageFreeGb} GB free of ${check.storageTotalGb ?? '—'} GB` : '—',
    battery: check?.batteryHealth != null ? `${check.batteryHealth}%` : '—',
    remarks: check?.remarks || '—',
    accessories: assignment.accessories.length
      ? assignment.accessories.map((a) => ({ name: a.label, qty: String(a.qty), returned: String(a.returnedQty ?? 0) }))
      : [{ name: 'None', qty: '—', returned: '—' }],
    parts: (PARTS[device.kind] || PARTS.other).map((p) => ({ label: p.label, state: PART_STATE_LABEL[parts[p.key]] || '—' })),
    security: [
      ...securityItemsFor(device.kind).map((s) => ({ label: s.label, state: security[s.key] === true ? 'On' : security[s.key] === false ? 'OFF' : '—' })),
      ...locationItemsFor(device.kind).map((s) => ({ label: s.label, state: location[s.key] === true ? 'On' : location[s.key] === false ? 'OFF' : '—' })),
    ],
    accounts: accounts.length ? accounts.map((a) => ({ kind: ACCOUNT_KINDS[a.kind] || a.kind, identifier: a.identifier })) : [{ kind: 'None recorded', identifier: '—' }],
  };
}

async function renderDocument(assignmentId, which) {
  const assignment = await DeviceAssignment.findById(assignmentId).lean();
  if (!assignment) throw ApiError.notFound('Handover not found');
  if (which === 'receipt' && assignment.status !== ASSIGNMENT_STATUS.RETURNED) throw ApiError.conflict('Not returned yet');
  const file = which === 'receipt' ? 'device-return.html' : 'device-handover.html';
  const html = await fs.readFile(path.join(env.templatesHtmlDir, file), 'utf8');
  const data = await documentData(assignment);
  const pdf = await renderPdfFromHtml(fillTemplate(html, data), env.templatesHtmlDir);
  return { pdf, filename: `${which === 'receipt' ? 'Device return receipt' : 'Device handover agreement'} - ${data.deviceCode} - ${data.employeeName}.pdf` };
}

async function uploadSigned(assignmentId, which, file, user) {
  if (!file) throw ApiError.badRequest('Choose the signed copy (PDF or photo)');
  const assignment = await DeviceAssignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Handover not found');
  const id = await saveFile(file, which === 'receipt' ? 'receipt' : 'agreement', user);
  if (which === 'receipt') assignment.signedReceipt = id;
  else {
    assignment.signedAgreement = id;
    assignment.signedAgreementAt = new Date();
  }
  await assignment.save();
  return assignment;
}

// ---------------------------------------------------------------- checks (HR / holder)

async function hrCheck(id, input, user, photos) {
  const device = await loadDevice(id);
  return recordCheck(device, { kind: CHECK_KIND.ADHOC, input, photos, user });
}

async function holderCheck(id, input, user, photos) {
  const device = await loadDevice(id);
  if (!device.holder || !isSelf(user, device.holder)) throw ApiError.forbidden('This device is not with you');
  const already = await DeviceCheck.findOne({ device: device._id, kind: CHECK_KIND.MONTHLY, month: monthKey(), status: { $ne: CHECK_STATUS.REJECTED } });
  if (already) throw ApiError.conflict(`This month's check is already ${already.status === CHECK_STATUS.VERIFIED ? 'done' : 'waiting for HR'}`);
  if (await checkOfMonth(device._id)) throw ApiError.conflict("HR has already checked it this month — nothing to send until next month");
  const check = await recordCheck(device, { kind: CHECK_KIND.MONTHLY, input, photos, user, byHolder: true });
  const hr = await userRepository.findHr();
  if (hr.length) {
    await notificationService.createForUsers(
      hr.map((u) => u._id),
      {
        type: NOTIFICATION_TYPES.DEVICE_CHECK_SUBMITTED,
        title: `${device.code}: monthly check to verify`,
        message: `${user.displayName || 'The holder'} sent this month's check for ${deviceName(device)}${check.flags.length ? ` — ${check.flags.join(', ').replace(/_/g, ' ')}` : ''}.`,
        employee: device.holder,
      }
    );
  }
  return check;
}

async function listChecks({ status, device } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (device) filter.device = device;
  return DeviceCheck.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('device', 'code kind brand model')
    .populate('employee', 'firstName lastName')
    .populate('by reviewedBy', 'username')
    .lean();
}

async function reviewCheck(id, { ok, note, locationSeen }, user) {
  const check = await DeviceCheck.findById(id).populate('device', 'code brand model');
  if (!check) throw ApiError.notFound('Check not found');
  if (check.status !== CHECK_STATUS.SUBMITTED) throw ApiError.conflict('This check was already reviewed');
  check.status = ok ? CHECK_STATUS.VERIFIED : CHECK_STATUS.REJECTED;
  check.reviewedBy = user.id;
  check.reviewedAt = new Date();
  check.reviewNote = note || undefined;
  await check.save();
  if (ok && locationSeen) await verifyLocation(check.device._id, { note: 'Seen on the map when verifying the monthly check' }, user);
  const holderUser = check.employee ? await userRepository.findByEmployeeId(check.employee) : null;
  if (holderUser) {
    await notificationService.createForUsers([holderUser._id], {
      type: NOTIFICATION_TYPES.DEVICE_CHECK_REVIEWED,
      title: ok ? `${check.device.code}: monthly check verified` : `${check.device.code}: monthly check sent back`,
      message: ok ? 'Thanks — your device check was verified.' : `Please do the check again${note ? `: ${note}` : '.'}`,
      employee: check.employee,
    });
  }
  return check;
}

// ---------------------------------------------------------------- issues

async function reportIssue(id, { category, description }, user, { byHolder }) {
  const device = await loadDevice(id);
  if (byHolder && (!device.holder || !isSelf(user, device.holder))) throw ApiError.forbidden('This device is not with you');
  if (!ISSUE_CATEGORIES[category]) throw ApiError.badRequest('Choose what the problem is');
  const issue = await DeviceIssue.create({ device: device._id, reportedBy: user.id, employee: device.holder, category, description });
  if (byHolder) {
    const hr = await userRepository.findHr();
    if (hr.length) {
      await notificationService.createForUsers(
        hr.map((u) => u._id),
        {
          type: NOTIFICATION_TYPES.DEVICE_ISSUE_REPORTED,
          title: `${device.code}: ${ISSUE_CATEGORIES[category]}`,
          message: `${user.displayName || 'The holder'} reported a problem with ${deviceName(device)}${description ? `: ${description}` : '.'}`,
          employee: device.holder,
        }
      );
    }
  }
  return issue;
}

async function listIssues({ status } = {}) {
  return DeviceIssue.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(300)
    .populate('device', 'code kind brand model')
    .populate('employee', 'firstName lastName')
    .populate('resolvedBy', 'username')
    .lean();
}

async function resolveIssue(id, { resolution }, user) {
  const issue = await DeviceIssue.findById(id).populate('device', 'code');
  if (!issue) throw ApiError.notFound('Issue not found');
  issue.status = 'resolved';
  issue.resolution = resolution || undefined;
  issue.resolvedBy = user.id;
  issue.resolvedAt = new Date();
  await issue.save();
  const reporter = issue.employee ? await userRepository.findByEmployeeId(issue.employee) : null;
  if (reporter && String(reporter._id) !== String(user.id)) {
    await notificationService.createForUsers([reporter._id], {
      type: NOTIFICATION_TYPES.DEVICE_ISSUE_RESOLVED,
      title: `${issue.device.code}: ${ISSUE_CATEGORIES[issue.category]} — resolved`,
      message: resolution || 'HR marked the problem you reported as resolved.',
      employee: issue.employee,
    });
  }
  return issue;
}

// ---------------------------------------------------------------- footage

// The company Google accounts whose Drive footage can go to — for the upload
// form (names and emails only).
async function shootDrives() {
  return DeviceAccount.find({ kind: 'google' }).select('label identifier').sort({ identifier: 1 }).lean();
}

const FOOTAGE_POPULATE = [
  { path: 'device', select: 'code brand model' },
  { path: 'employee', select: 'firstName lastName' },
  { path: 'uploadedBy', select: 'firstName lastName' },
  { path: 'client', select: 'name' },
  { path: 'driveAccount', select: 'label identifier' },
  { path: 'verifiedBy', select: 'username' },
];

async function logFootage(input, user, { byHolder }) {
  if (!input.driveLink || !/^https?:\/\//i.test(input.driveLink)) throw ApiError.badRequest('Paste the Google Drive link of the uploaded footage');
  const device = input.device ? await loadDevice(input.device) : null;
  if (byHolder && device && !isSelf(user, device.holder)) throw ApiError.forbidden('This device is not with you');
  const drive = input.driveAccount ? await DeviceAccount.findOne({ _id: input.driveAccount, kind: 'google' }).select('label identifier').lean() : null;
  if (input.driveAccount && !drive) throw ApiError.badRequest('Choose the Google Drive from the list');
  const uploader = input.uploadedBy ? await Employee.findById(input.uploadedBy).select('_id').lean() : null;
  if (input.uploadedBy && !uploader) throw ApiError.badRequest('Choose who uploaded it from the list');
  const logger = byHolder ? user.employeeLink : device?.holder || null;
  const upload = await FootageUpload.create({
    device: device?._id || null,
    employee: logger,
    uploadedBy: uploader?._id || logger,
    driveAccount: drive?._id || null,
    driveName: drive ? drive.identifier : undefined,
    loggedBy: user.id,
    shootDate: input.shootDate ? new Date(input.shootDate) : null,
    client: input.client || null,
    clientName: input.clientName || undefined,
    driveLink: input.driveLink,
    files: num(input.files),
    sizeGb: num(input.sizeGb),
    clearedFromPhone: Boolean(input.clearedFromPhone),
    note: input.note || undefined,
  });
  return upload;
}

async function listFootage({ device, toVerify } = {}) {
  const filter = {};
  if (device) filter.device = device;
  if (toVerify === 'true' || toVerify === true) filter.verifiedAt = null;
  return FootageUpload.find(filter).sort({ createdAt: -1 }).limit(300).populate(FOOTAGE_POPULATE).lean();
}

// HR opened the Drive link and the footage is there (or takes that back).
async function verifyFootage(id, verified, user) {
  const upload = await FootageUpload.findById(id);
  if (!upload) throw ApiError.notFound('Upload not found');
  upload.verifiedAt = verified ? new Date() : null;
  upload.verifiedBy = verified ? user.id : null;
  await upload.save();
  return upload;
}

// HR saw the device on the map — Google Maps location sharing or Find My.
async function verifyLocation(id, { note } = {}, user) {
  const device = await loadDevice(id);
  device.locationVerified = { at: new Date(), by: user.id, note: note ? String(note).slice(0, 300) : undefined };
  await device.save();
  return device;
}

async function setFootageCleared(id, cleared) {
  const upload = await FootageUpload.findByIdAndUpdate(id, { clearedFromPhone: Boolean(cleared) }, { new: true });
  if (!upload) throw ApiError.notFound('Upload not found');
  return upload;
}

// ---------------------------------------------------------------- accessories

async function createAccessory(data) {
  if (!data.name) throw ApiError.badRequest('Name the accessory');
  return DeviceAccessory.create({ name: data.name, kind: data.kind || 'other', totalQty: num(data.totalQty) ?? 0, unitValue: num(data.unitValue) ?? 0, notes: data.notes });
}

async function updateAccessory(id, data) {
  const accessory = await DeviceAccessory.findById(id);
  if (!accessory) throw ApiError.notFound('Accessory not found');
  for (const key of ['name', 'kind', 'notes']) if (data[key] !== undefined) accessory[key] = data[key];
  for (const key of ['totalQty', 'unitValue']) if (num(data[key]) !== undefined) accessory[key] = num(data[key]);
  const out = (await accessoryStock()).find((a) => String(a._id) === String(id))?.out || 0;
  if (accessory.totalQty < out) throw ApiError.conflict(`${out} are handed out — the total can't be less than that`);
  await accessory.save();
  return accessory;
}

// ---------------------------------------------------------------- the holder's own view

// The devices someone holds, for their EMS profile ("My devices"): what it
// is, since when, its accessories and this month's check — never serials,
// IMEI, SIM ids, accounts, prices or recovery values. Their own, or anyone's
// for HR (who also get the link into HR Work).
async function heldForProfile(viewer, employeeId) {
  const { can } = require('../utils/roles');
  const { ACCESS } = require('../config/access');
  const manages = can(viewer, ACCESS.HRMS);
  if (!manages && String(viewer.employeeLink || '') !== String(employeeId)) throw ApiError.forbidden('You can only see your own devices');
  const devices = await Device.find({ holder: employeeId, status: DEVICE_STATUS.ASSIGNED }).sort({ code: 1 }).lean();
  const ids = devices.map((d) => d._id);
  const [assignments, checks, issues] = await Promise.all([
    DeviceAssignment.find({ _id: { $in: devices.map((d) => d.assignment) } }).lean(),
    DeviceCheck.find({ device: { $in: ids }, kind: CHECK_KIND.MONTHLY, month: monthKey() }).sort({ createdAt: -1 }).lean(),
    DeviceIssue.find({ device: { $in: ids }, status: 'open' }).lean(),
  ]);
  return {
    canManage: manages,
    devices: devices.map((d) => {
      const a = assignments.find((x) => String(x._id) === String(d.assignment));
      const check = checks.find((c) => String(c.device) === String(d._id));
      return {
        _id: d._id,
        code: d.code,
        kind: d.kind,
        brand: d.brand || '',
        model: d.model || '',
        color: d.color || '',
        assignedAt: a?.assignedAt || null,
        acceptedAt: a?.acceptedAt || null,
        accessories: (a?.accessories || []).filter((x) => x?.label).map((x) => `${x.label}${x.qty > 1 ? ` ×${x.qty}` : ''}`),
        monthCheck: check ? { status: check.status, createdAt: check.createdAt } : null,
        openIssues: issues.filter((i) => String(i.device) === String(d._id)).length,
      };
    }),
  };
}

async function mine(user) {
  if (!user.employeeLink) return { devices: [] };
  const [devices, settings] = await Promise.all([
    Device.find({ holder: user.employeeLink, status: DEVICE_STATUS.ASSIGNED }).sort({ code: 1 }).lean(),
    getSettings(),
  ]);
  const ids = devices.map((d) => d._id);
  const [assignments, checks, issues, uploads, done] = await Promise.all([
    DeviceAssignment.find({ _id: { $in: devices.map((d) => d.assignment) } }).lean(),
    DeviceCheck.find({ device: { $in: ids }, kind: CHECK_KIND.MONTHLY, month: monthKey() }).sort({ createdAt: -1 }).lean(),
    DeviceIssue.find({ device: { $in: ids }, status: 'open' }).sort({ createdAt: -1 }).lean(),
    FootageUpload.find({ $or: [{ employee: user.employeeLink }, { uploadedBy: user.employeeLink }] }).sort({ createdAt: -1 }).limit(50).populate(FOOTAGE_POPULATE).lean(),
    checksOfMonth(ids),
  ]);
  const byId = (list, key) => (id) => list.find((x) => String(x[key]) === String(id));
  return {
    checkDueDay: settings.checkDueDay,
    month: monthKey(),
    apps: settings.apps,
    brand: settings.brand,
    locationAccount: settings.locationAccount || null,
    devices: devices.map((d) => {
      const assignment = byId(assignments, '_id')(d.assignment);
      const check = checks.find((c) => String(c.device) === String(d._id));
      const doneThisMonth = done.get(String(d._id));
      const newThisMonth = Boolean(assignment && monthKey(assignment.assignedAt) === monthKey());
      return {
        ...d,
        parts: PARTS[d.kind] || PARTS.other,
        securityItems: securityItemsFor(d.kind),
        locationItems: locationItemsFor(d.kind),
        assignment: assignment && {
          _id: assignment._id,
          assignedAt: assignment.assignedAt,
          acceptedAt: assignment.acceptedAt,
          accessories: assignment.accessories,
        },
        monthCheck: check ? { status: check.status, reviewNote: check.reviewNote, createdAt: check.createdAt } : null,
        // Checked this month (HR's own check, or theirs once verified): nothing more to send.
        checkedThisMonth: doneThisMonth ? { createdAt: doneThisMonth.createdAt, byHolder: Boolean(doneThisMonth.byHolder) } : null,
        newThisMonth,
        checkOverdue: !check && !doneThisMonth && !newThisMonth && istDay() > settings.checkDueDay,
        openIssues: issues.filter((i) => String(i.device) === String(d._id)),
      };
    }),
    footage: uploads,
  };
}

async function accept(assignmentId, user) {
  const assignment = await DeviceAssignment.findById(assignmentId);
  if (!assignment || !isSelf(user, assignment.employee)) throw ApiError.forbidden('This handover is not yours');
  if (assignment.status !== ASSIGNMENT_STATUS.ACTIVE) throw ApiError.conflict('This handover is over');
  if (!assignment.acceptedAt) {
    assignment.acceptedAt = new Date();
    await assignment.save();
  }
  return assignment;
}

// ---------------------------------------------------------------- Action centre (HR)

// Each item's id is what the Action centre's Acknowledge remembers: a
// missing check is per device per month, a leaver's device per handover.
async function actionItems() {
  const [assigned, toVerify, issues, runbooks, unsigned, uploads] = await Promise.all([
    list({ status: DEVICE_STATUS.ASSIGNED }),
    listChecks({ status: CHECK_STATUS.SUBMITTED }),
    listIssues({ status: 'open' }),
    DeviceRunbook.find({ status: 'open' }).populate('device', 'code').populate('employee', 'firstName lastName').lean(),
    DeviceAssignment.find({ status: ASSIGNMENT_STATUS.ACTIVE, signedAgreement: null, assignedAt: { $lte: new Date(Date.now() - 3 * 86400000) } })
      .populate('device', 'code brand model')
      .populate('employee', 'firstName lastName')
      .lean(),
    FootageUpload.find({ verifiedAt: null }).sort({ createdAt: 1 }).limit(50).populate(FOOTAGE_POPULATE).lean(),
  ]);
  const leavers = assigned.filter((d) => d.holder && d.holder.status === EMPLOYEE_STATUS.OFFBOARDED);
  const label = (d) => `${d.code} ${deviceName(d)}`.trim();
  return {
    checksToVerify: toVerify.map((c) => ({ id: c._id, text: `${label(c.device)} — ${nameOf(c.employee)}'s monthly check${c.flags?.length ? ` (${c.flags.join(', ').replace(/_/g, ' ')})` : ''}` })),
    checksOverdue: assigned.filter((d) => d.checkOverdue).map((d) => ({ id: `${d._id}-${monthKey()}`, text: `${label(d)} — ${nameOf(d.holder)} hasn't sent this month's check` })),
    unreturned: leavers.map((d) => ({ id: d.assignment || d._id, text: `${label(d)} is still with ${nameOf(d.holder)}, who has left` })),
    issues: issues.map((i) => ({ id: i._id, text: `${label(i.device)} — ${ISSUE_CATEGORIES[i.category]}${i.employee ? ` (${nameOf(i.employee)})` : ''}` })),
    runbooks: runbooks.map((r) => ({
      id: r._id,
      text: `${r.kind === 'lost' ? `Lost: ${r.device?.code || 'device'}` : `Revoke access: ${nameOf(r.employee)}`} — ${r.steps.filter((s) => s.done).length} of ${r.steps.length} steps done`,
    })),
    unsigned: unsigned.map((a) => ({ id: a._id, text: `${label(a.device)} — ${nameOf(a.employee)}'s handover agreement isn't signed yet` })),
    footageToVerify: uploads.map((u) => ({
      id: u._id,
      text: `${nameOf(u.uploadedBy || u.employee)} uploaded ${u.client?.name || u.clientName || 'shoot footage'}${u.driveName ? ` to ${u.driveName}` : ''} — open the link and verify it`,
    })),
  };
}

// ---------------------------------------------------------------- full & final

// What a leaver still holds — their full & final waits for these.
async function heldBy(employeeId) {
  return Device.find({ holder: employeeId, status: DEVICE_STATUS.ASSIGNED }).select('code kind brand model').lean();
}

// What is owed for devices lost, or accessories not returned, by someone —
// not waived and not yet recovered.
async function recoveryFor(employeeId) {
  const assignments = await DeviceAssignment.find({
    employee: employeeId,
    recoveryAmount: { $gt: 0 },
    recoverySettledIn: null,
    recoveryWaivedAt: null,
  })
    .populate('device', 'code brand model')
    .lean();
  const items = assignments.map((a) => ({
    assignment: a._id,
    label: `${a.device?.code || 'Device'} ${deviceName(a.device || {})}${a.status === ASSIGNMENT_STATUS.LOST ? ' (lost)' : ` (${a.recoveryNote || 'not returned'})`}`.trim(),
    amount: a.recoveryAmount,
  }));
  return { amount: Math.round(items.reduce((t, i) => t + i.amount, 0) * 100) / 100, items };
}

async function markRecoverySettled(assignmentIds, settlementId) {
  if (!assignmentIds?.length) return;
  await DeviceAssignment.updateMany({ _id: { $in: assignmentIds } }, { recoverySettledIn: settlementId });
}

// ---------------------------------------------------------------- monthly reminders

// The 1st: everyone holding a device is reminded of the month's check; the
// day after it is due, those who haven't sent one are reminded again.
async function sendMonthlyReminders(now = new Date()) {
  const settings = await getSettings();
  const day = istDay(now);
  if (day !== 1 && day !== settings.checkDueDay + 1) return 0;
  const devices = await list({ status: DEVICE_STATUS.ASSIGNED });
  const targets = devices.filter((d) => !d.newThisMonth && !d.checkThisMonth && (day === 1 || !d.monthCheck));
  const byHolder = new Map();
  for (const d of targets) {
    if (!d.holder || d.holder.status !== EMPLOYEE_STATUS.ACTIVE) continue;
    const key = String(d.holder._id);
    if (!byHolder.has(key)) byHolder.set(key, []);
    byHolder.get(key).push(d.code);
  }
  for (const [employeeId, codes] of byHolder) {
    // eslint-disable-next-line no-await-in-loop
    const user = await userRepository.findByEmployeeId(employeeId);
    if (!user) continue;
    // eslint-disable-next-line no-await-in-loop
    await notificationService.createForUsers([user._id], {
      type: NOTIFICATION_TYPES.DEVICE_CHECK_DUE,
      title: day === 1 ? 'Monthly device check' : 'Device check overdue',
      message:
        day === 1
          ? `Please send this month's check for ${codes.join(', ')} by the ${settings.checkDueDay}th — "My devices" on your dashboard.`
          : `This month's check for ${codes.join(', ')} hasn't been sent — "My devices" on your dashboard.`,
      employee: employeeId,
    });
  }
  return byHolder.size;
}

module.exports = {
  heldForProfile,
  getSettings,
  saveFile,
  getFile,
  list,
  summary,
  create,
  update,
  detail,
  assign,
  returnDevice,
  markLost,
  markFound,
  setStatus,
  remove,
  setStepDone,
  waiveRecovery,
  renderDocument,
  uploadSigned,
  hrCheck,
  holderCheck,
  listChecks,
  reviewCheck,
  reportIssue,
  listIssues,
  resolveIssue,
  logFootage,
  listFootage,
  setFootageCleared,
  verifyFootage,
  verifyLocation,
  shootDrives,
  accessoryStock,
  createAccessory,
  updateAccessory,
  mine,
  accept,
  actionItems,
  heldBy,
  recoveryFor,
  markRecoverySettled,
  sendMonthlyReminders,
  monthKey,
};
