const employeeRepository = require('../repositories/employee.repository');

// HR Work's "Inventory details" column-picker report (frontendhr) — every
// active employee's device/SIM/accessory fields. Always returns every
// inventory field; which columns to actually show is a frontend-only
// concern once the data is available.
async function listInventory() {
  const employees = await employeeRepository.listActive();
  return employees.map((employee) => ({
    employeeId: employee._id,
    employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
    employeeCode: employee.employeeCode,
    designation: employee.designation,
    inventory: employee.inventory || {},
  }));
}

module.exports = { listInventory };
