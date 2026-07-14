const ApiError = require('../utils/ApiError');
const clientRepository = require('../repositories/client.repository');
const meetingRepository = require('../repositories/meeting.repository');
const clientActivity = require('./clientActivity.service');

async function createMeeting(clientId, { topic, agenda, meetingDate, attendees }) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  const meeting = await meetingRepository.create({
    client: clientId,
    topic,
    agenda,
    meetingDate,
    attendees: attendees || [],
  });
  await clientActivity.log(clientId, 'MEETING_SCHEDULED', { topic, meetingDate });
  return meeting;
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
  const updated = await meetingRepository.updateById(meetingId, { mom });
  await clientActivity.log(meeting.client, 'MEETING_HELD', { topic: meeting.topic });
  return updated;
}

module.exports = { createMeeting, listMeetings, updateMinutes };
