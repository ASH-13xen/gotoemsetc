import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UpcomingMeeting } from '@/api/dashboard.api'

export function UpcomingMeetingsWidget({ meetings }: { meetings: UpcomingMeeting[] }) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-widest">Upcoming Meetings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
        ) : (
          meetings.map((meeting) => (
            <button
              key={meeting._id}
              onClick={() => meeting.client && navigate(`/clients/${meeting.client._id}`)}
              className="flex flex-col items-start border-2 border-foreground/30 p-2 text-left hover:bg-accent"
            >
              <span className="text-sm font-bold">{meeting.client?.clientName ?? 'Internal'}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(meeting.meetingDate).toLocaleString()}
              </span>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}
