const ApiError = require('../utils/ApiError');
const clientRepository = require('../repositories/client.repository');
const meetingRepository = require('../repositories/meeting.repository');

async function createMeeting(clientId, { mom, meetingDate, attendees }) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  return meetingRepository.create({
    client: clientId,
    mom,
    meetingDate,
    attendees: attendees || [],
  });
}

async function listMeetings(clientId) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');
  return meetingRepository.listByClient(clientId);
}

module.exports = { createMeeting, listMeetings };
