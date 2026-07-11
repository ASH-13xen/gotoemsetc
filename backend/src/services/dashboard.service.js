const employeeRepository = require('../repositories/employee.repository');
const uploadRequestRepository = require('../repositories/uploadRequest.repository');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');

async function getStats() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalEmployees, pendingUploadRequests, documentsGeneratedThisMonth, activeEmployees, offboardedEmployees] = await Promise.all([
    employeeRepository.count(),
    uploadRequestRepository.countPending(),
    generatedDocumentRepository.countCompletedSince(startOfMonth),
    employeeRepository.countByStatus('active'),
    employeeRepository.countByStatus('offboarded'),
  ]);

  return { totalEmployees, pendingUploadRequests, documentsGeneratedThisMonth, activeEmployees, offboardedEmployees };
}

module.exports = { getStats };
