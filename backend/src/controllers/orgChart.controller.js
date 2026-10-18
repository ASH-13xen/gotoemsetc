const asyncHandler = require('../utils/asyncHandler');
const orgChartService = require('../services/orgChart.service');

function audit(req, action, nodeId, metadata) {
  req.auditContext = { action, resourceType: 'OrgNode', resourceId: nodeId, metadata };
}

const getTree = asyncHandler(async (req, res) => {
  const [nodes, linkableWorkTeams, coordinators] = await Promise.all([
    orgChartService.getTree(),
    orgChartService.listLinkableWorkTeams(),
    orgChartService.listCoordinators(),
  ]);
  res.json({ nodes, linkableWorkTeams, coordinators });
});

const setCoordinators = asyncHandler(async (req, res) => {
  const coordinators = await orgChartService.setCoordinators(req.body.employeeIds);
  req.auditContext = { action: 'orgChart.coordinators', resourceType: 'Employee', metadata: { employeeIds: req.body.employeeIds } };
  res.json({ coordinators });
});

const createNode = asyncHandler(async (req, res) => {
  const node = await orgChartService.createNode(req.body);
  audit(req, 'orgChart.create', node._id, { title: node.title, kind: node.kind, parent: node.parent });
  res.status(201).json({ node });
});

const updateNode = asyncHandler(async (req, res) => {
  const node = await orgChartService.updateNode(req.params.id, req.body);
  audit(req, 'orgChart.update', node._id, req.body);
  res.json({ node });
});

const moveNode = asyncHandler(async (req, res) => {
  const node = await orgChartService.moveNode(req.params.id, req.body);
  audit(req, 'orgChart.move', node._id, req.body);
  res.json({ node });
});

const deleteNode = asyncHandler(async (req, res) => {
  const result = await orgChartService.deleteNode(req.params.id, { mode: req.query.mode });
  audit(req, 'orgChart.delete', req.params.id, { mode: req.query.mode || 'lift' });
  res.json(result);
});

const setAssignees = asyncHandler(async (req, res) => {
  const node = await orgChartService.setAssignees(req.params.id, req.body.employeeIds);
  audit(req, 'orgChart.assign', node._id, { employeeIds: req.body.employeeIds });
  res.json({ node });
});

module.exports = { getTree, createNode, updateNode, moveNode, deleteNode, setAssignees, setCoordinators };
