import type { CalendarTicket, Ticket } from '@/api/tickets.api'
import type { StubData } from '@/components/tickets/TicketStub'

export function ticketStub(t: Ticket): StubData {
  return {
    id: t._id,
    code: t.code,
    title: t.title,
    pipelineName: t.pipelineName,
    priority: t.priority,
    color: t.color,
    stageLabel: t.stageLabel,
    trail: t.trail,
    clientName: t.clientName,
    teamTitle: t.team?.title,
    raisedByName: t.raisedBy.name,
    raisedForName: t.raisedFor.name,
    dueAt: t.dueAt,
    status: t.status,
    isOverdue: t.isOverdue,
    isSentBack: t.isSentBack,
    isRejected: t.isRejected,
    waitingOnLabel: t.waitingOnLabel,
    nextStepLabel: t.nextStepLabel,
    waitingOn: t.waitingOn,
  }
}

export function calendarStub(t: CalendarTicket): StubData {
  return {
    id: t._id,
    code: t.code,
    title: t.title,
    pipelineName: t.pipelineName,
    color: t.color,
    stageLabel: t.kind === 'stories' ? undefined : t.stageLabel,
    trail: t.trail,
    clientName: undefined,
    teamTitle: t.team?.title,
    dueAt: t.dueAt,
    status: t.status,
    isOverdue: t.isOverdue,
    isSentBack: t.isSentBack,
    isRejected: t.isRejected,
    waitingOnLabel: t.waitingOnLabel,
    nextStepLabel: t.nextStepLabel,
    days: t.days,
    doneCount: t.doneCount,
    total: t.total,
    auto: true,
  }
}

export const calendarLink = (t: CalendarTicket) => (t.kind === 'stories' ? `/calendar/stories/${t._id}` : `/calendar/items/${t._id}`)
