const ApiError = require('../utils/ApiError');
const clientRepository = require('../repositories/client.repository');
const meetingRepository = require('../repositories/meeting.repository');

async function createMeeting(clientId, { topic, agenda, meetingDate, attendees }) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  return meetingRepository.create({
    client: clientId,
    topic,
    agenda,
    meetingDate,
    attendees: attendees || [],
  });
}

async function listMeetings(clientId) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');
  return meetingRepository.listByClient(clientId);
}

// Minutes can only be recorded once the scheduled time has actually passed.
async function updateMinutes(meetingId, mom) {
  const meeting = await meetingRepository.findById(meetingId);
  if (!meeting) throw ApiError.notFound('Meeting not found');
  if (meeting.meetingDate.getTime() > Date.now()) {
    throw ApiError.badRequest('Minutes can only be added after the meeting has taken place');
  }
  return meetingRepository.updateById(meetingId, { mom });
}

module.exports = { createMeeting, listMeetings, updateMinutes };
