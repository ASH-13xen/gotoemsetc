import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Briefcase, ChevronDown, Clapperboard, Crown, Megaphone, Sparkles, UserPlus, Users, Video, Star, KeyRound, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrgNode } from '@/api/orgChart.api'
import { TEAM_ROLE_LABEL, GRANT_INFO } from '@/api/orgChart.api'
import { MAX_PEOPLE_ON_CARD, avatarGradient, fullName, initials, type Accent } from './orgTree'

export interface OrgCardData extends Record<string, unknown> {
  org: OrgNode
  accent: Accent
  width: number
  height: number
  childCount: number
  collapsed: boolean
  selected: boolean
  highlight: 'match' | 'path' | null
  dimmed: boolean
  dropTarget: 'valid' | 'invalid' | null
  // Team boxes: everyone across the team's role boxes, and how many of
  // those roles have someone. Team roles: the team's name.
  team?: { people: OrgNode['assignees']; rolesFilled: number; rolesTotal: number }
  teamName?: string
  onToggle: (id: string) => void
}

export type OrgCardNodeType = Node<OrgCardData, 'orgCard'>

function KindIcon({ org }: { org: OrgNode }) {
  const cls = 'size-4 text-white'
  if (!org.parent) return <Crown className={cls} />
  if (org.kind === 'team') return <Users className={cls} />
  if (org.kind === 'team_role') {
    if (org.isTeamHead) return <Star className={cls} />
    if (org.teamRole === 'videographer') return <Video className={cls} />
    if (org.teamRole === 'editor') return <Clapperboard className={cls} />
    if (org.teamRole === 'social_media_manager') return <Megaphone className={cls} />
    return <Sparkles className={cls} />
  }
  return <Briefcase className={cls} />
}

function subtitle(org: OrgNode, childCount: number, teamName?: string) {
  if (!org.parent) return 'Top of the organisation'
  if (org.kind === 'team') {
    return `Team · ${childCount} role${childCount === 1 ? '' : 's'}${org.workTeam ? '' : ' · not linked'}`
  }
  if (org.kind === 'team_role') {
    const role = org.teamRole ? TEAM_ROLE_LABEL[org.teamRole] : 'Team role'
    if (org.isTeamHead) return `Leads ${teamName ?? 'the team'}`
    return role === org.title ? `${teamName ?? 'Team'} team` : role
  }
  return org.description || (childCount ? `${childCount} reporting box${childCount === 1 ? '' : 'es'}` : 'Position')
}

function OrgCardNodeInner({ data }: NodeProps<OrgCardNodeType>) {
  const { org, accent, width, height, childCount, collapsed, selected, highlight, dimmed, dropTarget, onToggle, team, teamName } = data
  const isRole = org.kind === 'team_role'
  const isRoot = !org.parent
  const people = org.assignees.slice(0, MAX_PEOPLE_ON_CARD)
  const extra = org.assignees.length - people.length
  const canCollapse = !isRole && childCount > 0

  return (
    <div
      className={cn(
        'org-card group relative flex flex-col overflow-hidden rounded-2xl border bg-card/90 backdrop-blur-md transition-[box-shadow,opacity,transform] duration-300',
        'shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.25)] hover:shadow-[0_2px_4px_rgba(15,23,42,0.08),0_18px_40px_-16px_rgba(15,23,42,0.35)]',
        selected ? 'border-transparent' : 'border-border',
        dimmed && 'opacity-30',
        dropTarget === 'valid' && 'scale-[1.03]'
      )}
      style={{
        width,
        height,
        boxShadow: selected
          ? `0 0 0 2px ${accent.from}, 0 18px 44px -14px ${accent.from}66`
          : dropTarget === 'valid'
            ? `0 0 0 2px #22c55e, 0 18px 44px -14px #22c55e66`
            : dropTarget === 'invalid'
              ? `0 0 0 2px #ef4444`
              : undefined,
      }}
    >
      {/* Accent wash + bar */}
      <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(160deg, ${accent.soft}, transparent 55%)` }} />
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
      {highlight === 'match' && (
        <div className="org-pulse pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: `0 0 0 3px ${accent.from}` }} />
      )}

      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />
      {isRole && <Handle id="left" type="target" position={Position.Left} className="!opacity-0" isConnectable={false} />}

      <div className={cn('relative flex items-center gap-3 px-3.5', isRole ? 'pt-3' : 'pt-4')}>
        <span
          className={cn('flex shrink-0 items-center justify-center rounded-xl shadow-sm', isRoot ? 'size-10' : 'size-9')}
          style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
        >
          <KindIcon org={org} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn('truncate font-bold tracking-tight text-foreground', isRoot ? 'text-base' : 'text-sm')}>{org.title}</p>
            {org.isTeamHead && (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide text-white uppercase"
                style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
              >
                Head
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{subtitle(org, childCount, teamName)}</p>
          {org.grantsRole && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-px text-[9.5px] font-bold text-primary">
              <KeyRound className="size-2.5" /> {GRANT_INFO[org.grantsRole].label} access
            </span>
          )}
        </div>
        {canCollapse && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(org._id)
            }}
            className="nodrag flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-card/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            title={collapsed ? `Show ${childCount} hidden box${childCount === 1 ? '' : 'es'}` : 'Collapse'}
          >
            {collapsed && <span>{childCount}</span>}
            <ChevronDown className={cn('size-3 transition-transform duration-300', !collapsed && 'rotate-180')} />
          </button>
        )}
      </div>

      <div className="relative mt-2.5 flex flex-1 flex-col gap-1 px-2.5">
        {team ? (
          <div className="flex h-9 items-center gap-2 px-1">
            <div className="flex -space-x-2">
              {team.people.slice(0, 5).map((person) => (
                <span
                  key={person._id}
                  title={fullName(person)}
                  className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-card"
                  style={{ background: avatarGradient(person._id) }}
                >
                  {initials(person)}
                </span>
              ))}
              {team.people.length === 0 && (
                <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground">
                  <UserPlus className="size-3" />
                </span>
              )}
            </div>
            <div className="ml-auto text-right leading-tight">
              <p className="text-[11px] font-bold text-foreground tabular-nums">
                {team.rolesFilled}/{team.rolesTotal} roles
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {team.people.length} {team.people.length === 1 ? 'person' : 'people'}
              </p>
            </div>
          </div>
        ) : isRoot ? (
          <div className="flex h-9 items-center gap-2 rounded-lg bg-secondary/60 px-2.5 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Admin login only
          </div>
        ) : people.length === 0 && org.grantsRole ? (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-rose-400/80 bg-rose-50/80 px-2.5 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <UserPlus className="size-3.5" />
            Needs someone
          </div>
        ) : people.length === 0 ? (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-amber-400/70 bg-amber-50/70 px-2.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <UserPlus className="size-3.5" />
            Vacant
          </div>
        ) : (
          people.map((person) => (
            <div key={person._id} className="flex h-9 items-center gap-2 rounded-lg px-1.5 transition-colors group-hover:bg-secondary/40">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-card"
                style={{ background: avatarGradient(person._id) }}
              >
                {initials(person)}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-semibold text-foreground capitalize">{fullName(person).toLowerCase()}</p>
                <p className="truncate text-[10px] text-muted-foreground capitalize">{(person.designation || '').toLowerCase()}</p>
              </div>
            </div>
          ))
        )}
        {extra > 0 && <p className="px-1.5 text-[10px] font-medium text-muted-foreground">+{extra} more</p>}
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0" isConnectable={false} />
      {org.kind === 'team' && (
        <Handle id="rail" type="source" position={Position.Bottom} style={{ left: 14 }} className="!opacity-0" isConnectable={false} />
      )}
      {dropTarget && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-3 bottom-2 rounded-md py-0.5 text-center text-[10px] font-bold text-white',
            dropTarget === 'valid' ? 'bg-emerald-500' : 'bg-red-500'
          )}
        >
          {dropTarget === 'valid' ? 'Drop to move here' : "Can't move here"}
        </div>
      )}
    </div>
  )
}

export const OrgCardNode = memo(OrgCardNodeInner)
