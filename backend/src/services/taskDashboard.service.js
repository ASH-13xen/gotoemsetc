const clientRepository = require('../repositories/client.repository');
const taskRepository = require('../repositories/task.repository');
const employeeRepository = require('../repositories/employee.repository');
const { filterAccessibleClients } = require('../utils/clientAccess');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function getAccessibleClients(user) {
  const { items } = await clientRepository.list({ limit: 1000 });
  return filterAccessibleClients(user, items);
}

// Overdue steps, steps due within the next 7 days, and a per-client
// completion rate — scoped to whatever clients this user can actually see.
async function getDashboard(user) {
  const clients = await getAccessibleClients(user);
  const clientIds = clients.map((c) => c._id);
  if (clientIds.length === 0) return { overdue: [], dueThisWeek: [], completionByClient: [] };

  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 7 * MS_PER_DAY);

  const tasks = await taskRepository.listActiveForClients(clientIds);
  const overdue = [];
  const dueThisWeek = [];
  for (const task of tasks) {
    for (const step of task.steps) {
      if (!step.dueDate || step.status === 'done') continue;
      const entry = { task, step };
      if (step.dueDate < today) overdue.push(entry);
      else if (step.dueDate <= weekFromNow) dueThisWeek.push(entry);
    }
  }

  const completionByClient = [];
  for (const client of clients) {
    // eslint-disable-next-line no-await-in-loop
    const clientTasks = await taskRepository.listForClient(client._id);
    if (clientTasks.length === 0) continue;
    const done = clientTasks.filter((t) => t.status === 'done').length;
    completionByClient.push({
      client: { _id: client._id, clientName: client.clientName, brandName: client.brandName, logoUrl: client.logoUrl },
      total: clientTasks.length,
      done,
      rate: done / clientTasks.length,
    });
  }

  return { overdue, dueThisWeek, completionByClient };
}

// Admin-facing: active task counts per employee, across every client — spot
// who's overloaded at a glance.
async function getWorkloadSummary() {
  const counts = await taskRepository.countActiveByEmployee();
  const employeeIds = counts.map((c) => c._id);
  const employees = await employeeRepository.findByIds(employeeIds);
  const byId = new Map(employees.map((e) => [e._id.toString(), e]));

  return counts
    .map((c) => {
      const employee = byId.get(c._id.toString());
      if (!employee) return null;
      return {
        employee: { _id: employee._id, firstName: employee.firstName, lastName: employee.lastName, designation: employee.designation },
        activeCount: c.count,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.activeCount - a.activeCount);
}

async function getWorkloadForEmployee(employeeId) {
  return taskRepository.listByAssignee(employeeId);
}

// Every step with a due date inside [from, to], across accessible clients —
// the content calendar's data source.
async function getContentCalendar(user, from, to) {
  const clients = await getAccessibleClients(user);
  const clientIds = clients.map((c) => c._id);
  if (clientIds.length === 0) return [];
  return taskRepository.listByClientsInWindow(clientIds, from, to);
}

module.exports = { getAccessibleClients, getDashboard, getWorkloadSummary, getWorkloadForEmployee, getContentCalendar };
