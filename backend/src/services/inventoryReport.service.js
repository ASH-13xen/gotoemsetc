const employeeRepository = require('../repositories/employee.repository');
const { synthesizeLegacyInventoryItems } = require('./employee.service');

const ITEM_FIELDS = [
  'deviceName',
  'serialNumber',
  'color',
  'condition',
  'password',
  'theftProtection',
  'findMyDevice',
  'thumbOrFace',
  'simProvider',
  'simPhoneNumber',
  'screenGuard',
  'backCover',
  'powerAdapter',
  'cable',
  'mobileOS',
  'appleId',
  'whatsappTwoFactor',
  'whatsappTwoFactorBackupMail',
  'whatsappTwoFactorPin',
  'whatsappNameUpdated',
  'whatsappProfiling',
  'whatsappBackupInEmployeeMail',
  'galleryBackupInEmployeeMail',
  'trueCallerUpdated',
  'mouse',
];

function toItemRow(employee, item) {
  const row = {
    itemId: item._id,
    employeeId: employee._id,
    employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
    employeeCode: employee.employeeCode,
    designation: employee.designation,
    category: item.category,
  };
  for (const field of ITEM_FIELDS) row[field] = item[field];
  return row;
}

// HR Work's "Inventory details" report (frontendhr) — one row per
// categorized inventory item (Office/Personal Phone, Office/Personal
// Laptop) across every active employee, filterable by category. Employees
// who haven't had their own profile opened since categorized inventory
// shipped haven't gone through getEmployee's one-time migration yet — rather
// than have them silently missing here until someone happens to open their
// profile, the same synthesis is applied read-only (not persisted) as a
// fallback, so the report is always complete regardless of migration order.
async function listInventory() {
  const employees = await employeeRepository.listActive();
  const rows = [];
  for (const employee of employees) {
    const items =
      (employee.inventoryItems ?? []).length > 0
        ? employee.inventoryItems
        : synthesizeLegacyInventoryItems(employee.inventory);
    for (const item of items) rows.push(toItemRow(employee, item));
  }
  return rows;
}

module.exports = { listInventory };
