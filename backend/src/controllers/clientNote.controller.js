const asyncHandler = require('../utils/asyncHandler');
const clientNoteService = require('../services/clientNote.service');

const create = asyncHandler(async (req, res) => {
  const note = await clientNoteService.addNote(req.params.id, req.body.body, req.user.id);
  req.auditContext = { action: 'clientNote.create', resourceType: 'ClientNote', resourceId: note._id };
  res.status(201).json({ note });
});

const listForClient = asyncHandler(async (req, res) => {
  const notes = await clientNoteService.listForClient(req.params.id);
  res.json({ notes });
});

const remove = asyncHandler(async (req, res) => {
  await clientNoteService.deleteNote(req.params.noteId);
  req.auditContext = { action: 'clientNote.delete', resourceType: 'ClientNote', resourceId: req.params.noteId };
  res.status(204).send();
});

module.exports = { create, listForClient, remove };
