const { z } = require('zod');
const { STEP_STATUS } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });
const stepParam = z.object({ id: z.string().min(1), stepId: z.string().min(1) });
const attachmentParam = z.object({ id: z.string().min(1), attachmentIndex: z.string().regex(/^\d+$/) });
const employeeParam = z.object({ employeeId: z.string().min(1) });

const listForClient = { params: idParam, query: z.object({ cycleId: z.string().optional() }) };
const syncCycle = { params: idParam };
const getById = { params: idParam };

const updateAssignment = {
  params: idParam,
  body: z.object({
    assignedTeam: z.string().min(1).nullable().optional(),
    assignedEmployees: z.array(z.string().min(1)).optional(),
    leadEmployee: z.string().min(1).nullable().optional(),
  }),
};

const updateStepAssignment = {
  params: stepParam,
  body: z.object({
    label: z.string().min(1).optional(),
    whatToDo: z.string().optional(),
    assignedEmployees: z.array(z.string().min(1)).optional(),
    dueDate: z.coerce.date().nullable().optional(),
    requiresApproval: z.boolean().optional(),
  }),
};

const updateStepStatus = {
  params: stepParam,
  body: z.object({ status: z.enum(Object.values(STEP_STATUS)) }),
};

const decideStepApproval = {
  params: stepParam,
  body: z.object({ approved: z.boolean() }),
};

const addAttachment = {
  params: idParam,
  body: z.object({ label: z.string().min(1), url: z.string().url() }),
};

const removeAttachment = { params: attachmentParam };
const rollover = { params: idParam };

const stepInputSchema = z.object({ label: z.string().min(1), whatToDo: z.string().optional() });

const addStep = {
  params: idParam,
  body: z.object({
    label: z.string().min(1),
    whatToDo: z.string().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    requiresApproval: z.boolean().optional(),
  }),
};

const removeStep = { params: stepParam };

const updateTaskDetails = {
  params: idParam,
  body: z.object({ description: z.string().optional() }),
};

const deleteTask = { params: idParam };

const createManualTask = {
  params: idParam,
  body: z.object({
    sectionName: z.string().min(1),
    itemLabel: z.string().min(1),
    description: z.string().optional(),
    steps: z.array(stepInputSchema).optional(),
    quantity: z.coerce.number().int().positive().max(50).optional(),
  }),
};

const workloadForEmployee = { params: employeeParam };
const contentCalendar = { query: z.object({ from: z.string(), to: z.string() }) };

module.exports = {
  listForClient,
  syncCycle,
  getById,
  updateAssignment,
  updateStepAssignment,
  updateStepStatus,
  decideStepApproval,
  addAttachment,
  removeAttachment,
  rollover,
  addStep,
  removeStep,
  updateTaskDetails,
  deleteTask,
  createManualTask,
  workloadForEmployee,
  contentCalendar,
};
