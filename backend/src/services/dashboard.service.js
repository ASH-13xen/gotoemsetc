const employeeRepository = require('../repositories/employee.repository');
const uploadRequestRepository = require('../repositories/uploadRequest.repository');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');
const taskRepository = require('../repositories/task.repository');
const meetingRepository = require('../repositories/meeting.repository');

async function getStats() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalEmployees, pendingUploadRequests, documentsGeneratedThisMonth] = await Promise.all([
    employeeRepository.count(),
    uploadRequestRepository.countPending(),
    generatedDocumentRepository.countCompletedSince(startOfMonth),
  ]);

  return { totalEmployees, pendingUploadRequests, documentsGeneratedThisMonth };
}

async function getFollowupsStats() {
  const [overdueTasks, upcomingMeetings, clientsByStage] = await Promise.all([
    taskRepository.findOverdue(20),
    meetingRepository.listUpcoming(new Date(), 10),
    taskRepository.countByClientStage(),
  ]);

  return { overdueTasks, upcomingMeetings, clientsByStage };
}

module.exports = { getStats, getFollowupsStats };
