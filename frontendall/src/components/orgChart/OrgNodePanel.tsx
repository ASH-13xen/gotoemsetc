import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CornerDownRight,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { EmployeeSummary } from '@/api/employees.api'
import {
  GRANT_INFO,
  TEAM_ROLE_LABEL,
  type GrantableRole,
  type LinkableWorkTeam,
  type OrgNode,
  type OrgNodeKind,
  type TeamRole,
} from '@/api/orgChart.api'
import {
  useCreateOrgNode,
  useDeleteOrgNode,
  useMoveOrgNode,
  useSetOrgNodeAssignees,
  useUpdateOrgNode,
} from '@/hooks/useOrgChart'
import {
  accentFor,
  avatarGradient,
  canMoveUnder,
  childrenOf,
  depthOf,
  fullName,
  initials,
  type OrgIndex,
} from './orgTree'

export function apiErrorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

const KIND_LABEL: Record<OrgNodeKind, string> = { position: 'Position', team: 'Team', team_role: 'Team role' }
const NONE = '__none__'

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('panel-section grid gap-2.5 border-t border-border/70 px-5 py-4', className)}>
      <h3 className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Avatar({ person, size = 'size-8' }: { person: { _id: string; firstName: string; lastName?: string }; size?: string }) {
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white', size)}
      style={{ background: avatarGradient(person._id) }}
    >
      {initials(person)}
    </span>
  )
}

// Searchable picker over active employees — adds one person per click and
// stays open so several people can be added in a row. The list opens inline
// (pushing the sections below down) rather than floating, so nothing else in
// the panel can ever sit on top of it and swallow the click.
function EmployeePicker({
  employees,
  excludeIds,
  onPick,
  busy,
}: {
  employees: EmployeeSummary[]
  excludeIds: Set<string>
  onPick: (employee: EmployeeSummary) => void
  busy: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return employees
      .filter((e) => !excludeIds.has(e._id))
      .filter((e) => !q || `${fullName(e)} ${e.designation ?? ''} ${e.employeeCode ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
  }, [employees, excludeIds, query])

  useEffect(() => setActive(0), [query])

  // Close when clicking anywhere outside the picker.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Keep the keyboard-highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (employee: EmployeeSummary) => {
    if (busy) return
    onPick(employee)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="grid gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((i) => Math.min(i + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && open && matches[active]) {
              e.preventDefault()
              pick(matches[active])
            } else if (e.key === 'Escape' && open) {
              // Close just the list, not the whole panel.
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
              setOpen(false)
            }
          }}
          placeholder="Search employees to assign…"
          className="h-9 pr-8 pl-8 text-sm"
        />
        {busy && <Loader2 className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <div ref={listRef} className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-1 shadow-sm">
          {matches.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              {employees.length === 0 ? 'Loading employees…' : 'No matching active employees.'}
            </p>
          ) : (
            matches.map((e, i) => (
              <button
                key={e._id}
                type="button"
                data-index={i}
                disabled={busy}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(e)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-60',
                  i === active ? 'bg-secondary' : 'hover:bg-secondary'
                )}
              >
                <Avatar person={e} size="size-7" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground capitalize">{fullName(e).toLowerCase()}</span>
                  <span className="block truncate text-[11px] text-muted-foreground capitalize">{(e.designation ?? '').toLowerCase()}</span>
                </span>
                <UserPlus className="ml-auto size-3.5 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function OrgNodePanel({
  node,
  index,
  employees,
  linkableWorkTeams,
  onClose,
  onSelect,
  readOnly = false,
}: {
  node: OrgNode
  index: OrgIndex
  employees: EmployeeSummary[]
  linkableWorkTeams: LinkableWorkTeam[]
  onClose: () => void
  onSelect: (id: string | null) => void
  // Non-admins see who is where but can't change anything.
  readOnly?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const accent = accentFor(index, node)
  const isRoot = !node.parent
  const parent = node.parent ? index.byId.get(node.parent) : null

  const update = useUpdateOrgNode()
  const assign = useSetOrgNodeAssignees()
  const move = useMoveOrgNode()
  const create = useCreateOrgNode()
  const remove = useDeleteOrgNode()

  const [title, setTitle] = useState(node.title)
  const [description, setDescription] = useState(node.description ?? '')
  const [moveTarget, setMoveTarget] = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newKind, setNewKind] = useState<OrgNodeKind>(node.kind === 'team' ? 'team_role' : 'position')
  const [newRole, setNewRole] = useState<TeamRole>('social_media_manager')
  const [newWorkTeam, setNewWorkTeam] = useState<string>(NONE)

  // Re-seed the form whenever a different box is opened.
  useEffect(() => {
    setTitle(node.title)
    setDescription(node.description ?? '')
    setMoveTarget('')
    setConfirmDelete(false)
    setNewTitle('')
    setNewKind(node.kind === 'team' ? 'team_role' : 'position')
    setNewWorkTeam(NONE)
  }, [node._id, node.title, node.description, node.kind])

  useLayoutEffect(() => {
    if (!panelRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(panelRef.current, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' })
      gsap.fromTo(
        '.panel-section',
        { y: 14, opacity: 0 },
        // clearProps: a leftover transform makes each section its own
        // stacking layer, painting later sections over earlier ones.
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, delay: 0.08, ease: 'power2.out', clearProps: 'transform,opacity' }
      )
    }, panelRef)
    return () => ctx.revert()
  }, [node._id])

  const assigneeIds = useMemo(() => new Set(node.assignees.map((a) => a._id)), [node.assignees])
  const siblings = parent ? childrenOf(index, parent._id) : []
  const siblingIndex = siblings.findIndex((s) => s._id === node._id)

  const moveOptions = useMemo(
    () =>
      [...index.byId.values()]
        .filter((target) => target._id !== node.parent && canMoveUnder(index, node, target))
        .sort((a, b) => depthOf(index, a._id) - depthOf(index, b._id) || a.title.localeCompare(b.title)),
    [index, node]
  )

  const run = async (promise: Promise<unknown>, success: string, failure: string) => {
    try {
      await promise
      toast.success(success)
      return true
    } catch (err) {
      toast.error(apiErrorMessage(err, failure))
      return false
    }
  }

  const saveTitle = () => {
    const next = title.trim()
    if (!next || next === node.title) return setTitle(node.title)
    run(update.mutateAsync({ id: node._id, title: next }), 'Renamed', 'Could not rename')
  }

  const setPeople = (ids: string[], message: string) =>
    run(assign.mutateAsync({ id: node._id, employeeIds: ids }), message, 'Could not update people')

  const addChild = async () => {
    const childTitle = newKind === 'team_role' && !newTitle.trim() ? TEAM_ROLE_LABEL[newRole] : newTitle.trim()
    if (!childTitle) return toast.error('Give the new box a title')
    try {
      const { node: created } = (await create.mutateAsync({
        title: childTitle,
        parent: node._id,
        kind: newKind,
        ...(newKind === 'team_role' ? { teamRole: newRole } : {}),
        ...(newKind === 'team' && newWorkTeam !== NONE ? { workTeam: newWorkTeam } : {}),
      })) as { node: OrgNode }
      toast.success(`Added "${childTitle}"`)
      setNewTitle('')
      onSelect(created._id)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not add the box'))
    }
  }

  const doDelete = async (mode: 'lift' | 'branch') => {
    const ok = await run(
      remove.mutateAsync({ id: node._id, mode }),
      mode === 'branch' ? `Deleted "${node.title}" and everything under it` : `Deleted "${node.title}"`,
      'Could not delete'
    )
    if (ok) onSelect(null)
  }

  const childCount = childrenOf(index, node._id).length
  const canHaveChildren = node.kind !== 'team_role'
  const workTeamOptions = [
    ...(node.workTeam ? [{ _id: node.workTeam._id, name: node.workTeam.name }] : []),
    ...linkableWorkTeams,
  ]

  return (
    <div
      ref={panelRef}
      className="absolute top-4 right-4 bottom-4 z-20 flex w-[380px] flex-col overflow-hidden rounded-3xl border border-border bg-card/95 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl"
    >
      {/* Header */}
      <div className="relative px-5 pt-5 pb-4">
        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(150deg, ${accent.soft}, transparent 70%)` }} />
        <div className="relative flex items-start justify-between gap-3">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase"
            style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
          >
            {isRoot ? 'Top box' : KIND_LABEL[node.kind]}
            {node.isTeamHead ? ' · Team head' : ''}
          </span>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {readOnly ? (
          <h2 className="relative mt-3 text-2xl font-black tracking-tight text-foreground">{node.title}</h2>
        ) : (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          className="relative mt-3 w-full rounded-lg bg-transparent text-2xl font-black tracking-tight text-foreground outline-none focus:bg-secondary/50 focus:px-2"
          aria-label="Title"
        />
        )}
        <p className="relative mt-1 text-xs text-muted-foreground">
          {parent ? (
            <>
              Reports to <span className="font-semibold text-foreground">{parent.title}</span>
            </>
          ) : (
            'Everyone reports up to this box'
          )}
          {childCount > 0 && ` · ${childCount} box${childCount === 1 ? '' : 'es'} below`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {/* Team roster — a team box holds no one itself; people sit in its role boxes. */}
        {node.kind === 'team' && (
          <Section title="Team roster">
            <div className="grid gap-1.5">
              {childrenOf(index, node._id).map((role) => (
                <button
                  key={role._id}
                  type="button"
                  onClick={() => onSelect(role._id)}
                  className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/30 px-2.5 py-2 text-left transition-colors hover:bg-secondary/70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">
                      {role.title}
                      {role.isTeamHead && <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">· head</span>}
                    </p>
                    <p className={cn('truncate text-[11px] capitalize', role.assignees.length ? 'text-muted-foreground' : 'text-amber-600')}>
                      {role.assignees.length ? role.assignees.map((a) => fullName(a).toLowerCase()).join(', ') : 'vacant'}
                    </p>
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {readOnly ? 'Click a role to see who is in it.' : 'Click a role to assign people to it.'}
            </p>
          </Section>
        )}

        {/* The top box is the admin login itself — nobody is placed in it. */}
        {isRoot && (
          <Section title="Admin">
            <p className="text-xs text-muted-foreground">
              Admin access belongs to the <b>admin login</b> only. No one can be placed in this box, and no post can give admin access.
            </p>
          </Section>
        )}

        {/* What holding this post gives — admin sets it. */}
        {node.kind === 'position' && !isRoot && (
          <Section title="Gives access of">
            {readOnly ? (
              <p className="text-sm text-foreground">
                {node.grantsRole ? (
                  <>
                    <b>{GRANT_INFO[node.grantsRole].label}</b> — {GRANT_INFO[node.grantsRole].gives}
                  </>
                ) : (
                  'No extra access'
                )}
              </p>
            ) : (
              <>
                <Select
                  value={node.grantsRole ?? NONE}
                  onValueChange={(value) =>
                    run(
                      update.mutateAsync({ id: node._id, grantsRole: value === NONE ? null : (value as GrantableRole) }),
                      value === NONE ? 'This post no longer gives access' : `This post now gives ${GRANT_INFO[value as GrantableRole].label} access`,
                      'Could not change the access'
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No extra access</SelectItem>
                    {(Object.keys(GRANT_INFO) as GrantableRole[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {GRANT_INFO[role].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {node.grantsRole
                    ? `Whoever holds this post gets: ${GRANT_INFO[node.grantsRole].gives}. Takes effect within a minute — no sign-out needed.`
                    : 'Whoever holds this post keeps only their own employee access.'}
                </p>
              </>
            )}
          </Section>
        )}

        {/* People */}
        {node.kind !== 'team' && !isRoot && (
        <Section title={`People · ${node.assignees.length || (node.grantsRole ? 'Needs someone' : 'Vacant')}`}>
          {readOnly && node.assignees.length === 0 && <p className="text-xs text-amber-600">No one is in this position yet.</p>}
          {node.assignees.length > 0 && (
            <div className="grid gap-1.5">
              {node.assignees.map((person) => (
                <div key={person._id} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/30 px-2.5 py-2">
                  <Avatar person={person} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground capitalize">{fullName(person).toLowerCase()}</p>
                    <p className="truncate text-[11px] text-muted-foreground capitalize">{(person.designation ?? '').toLowerCase()}</p>
                  </div>
                  {!readOnly && (
                  <button
                    type="button"
                    disabled={assign.isPending}
                    onClick={() =>
                      setPeople(
                        node.assignees.filter((a) => a._id !== person._id).map((a) => a._id),
                        `Removed ${person.firstName}`
                      )
                    }
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                    aria-label={`Remove ${person.firstName}`}
                  >
                    <X className="size-3.5" />
                  </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
          <EmployeePicker
            employees={employees}
            excludeIds={assigneeIds}
            busy={assign.isPending}
            onPick={(e) => setPeople([...node.assignees.map((a) => a._id), e._id], `Assigned ${e.firstName}`)}
          />
          )}
          {!readOnly && node.kind === 'team_role' && (
            <p className="text-[11px] text-muted-foreground">
              Synced to the {parent?.title ?? 'team'} work team
              {node.isTeamHead ? ' — the first person here becomes the team leader.' : '.'}
            </p>
          )}
        </Section>
        )}

        {readOnly && node.description && (
          <Section title="About">
            <p className="text-sm whitespace-pre-line text-foreground">{node.description}</p>
          </Section>
        )}

        {/* Everything below is editing — admin only. */}
        {!readOnly && (
        <>
        {/* Details */}
        <Section title="Details">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this box is responsible for (optional)"
            rows={2}
            className="text-sm"
          />
          {description !== (node.description ?? '') && (
            <Button
              size="sm"
              className="w-fit"
              disabled={update.isPending}
              onClick={() => run(update.mutateAsync({ id: node._id, description }), 'Details saved', 'Could not save')}
            >
              Save details
            </Button>
          )}
          {node.kind === 'team' && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Linked work team</Label>
              <Select
                value={node.workTeam?._id ?? NONE}
                onValueChange={(value) =>
                  run(
                    update.mutateAsync({ id: node._id, workTeam: value === NONE ? null : value }),
                    'Work team link updated',
                    'Could not link the work team'
                  )
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not linked (chart only)</SelectItem>
                  {workTeamOptions.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {node.kind === 'team_role' && (
            <div className="grid gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Role in the work team</Label>
                <Select
                  value={node.teamRole ?? undefined}
                  onValueChange={(value) =>
                    run(update.mutateAsync({ id: node._id, teamRole: value as TeamRole }), 'Role updated', 'Could not update the role')
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {TEAM_ROLE_LABEL[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/70 px-3 py-2 text-sm select-none">
                <input
                  type="checkbox"
                  checked={node.isTeamHead}
                  onChange={(e) =>
                    run(
                      update.mutateAsync({ id: node._id, isTeamHead: e.target.checked }),
                      e.target.checked ? 'Marked as team head' : 'No longer team head',
                      'Could not update'
                    )
                  }
                  className="size-4 cursor-pointer accent-primary"
                />
                Team head (sets the team leader)
              </label>
            </div>
          )}
        </Section>

        {/* Structure */}
        {!isRoot && (
          <Section title="Position in the tree">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={siblingIndex <= 0 || move.isPending}
                onClick={() => run(move.mutateAsync({ id: node._id, order: siblingIndex - 1 }), 'Moved', 'Could not move')}
              >
                <ArrowLeft className="size-3.5" />
                {node.kind === 'team_role' ? 'Move up' : 'Move left'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={siblingIndex >= siblings.length - 1 || move.isPending}
                onClick={() => run(move.mutateAsync({ id: node._id, order: siblingIndex + 1 }), 'Moved', 'Could not move')}
              >
                {node.kind === 'team_role' ? 'Move down' : 'Move right'}
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={moveTarget} onValueChange={setMoveTarget}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue placeholder="Move under another box…" />
                </SelectTrigger>
                <SelectContent>
                  {moveOptions.map((target) => (
                    <SelectItem key={target._id} value={target._id}>
                      {'  '.repeat(depthOf(index, target._id))}
                      {target.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!moveTarget || move.isPending}
                onClick={async () => {
                  const target = index.byId.get(moveTarget)
                  const ok = await run(
                    move.mutateAsync({ id: node._id, parent: moveTarget }),
                    `Moved under ${target?.title}`,
                    'Could not move'
                  )
                  if (ok) setMoveTarget('')
                }}
              >
                <CornerDownRight className="size-3.5" />
                Move
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Tip: you can also drag a box onto another box on the canvas.</p>
          </Section>
        )}

        {/* Add a child */}
        {canHaveChildren && (
          <Section title="Add a box under this">
            {node.kind !== 'team' && (
              <div className="flex gap-1 rounded-xl bg-secondary/60 p-1">
                {(['position', 'team'] as OrgNodeKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setNewKind(kind)}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                      newKind === kind ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {KIND_LABEL[kind]}
                  </button>
                ))}
              </div>
            )}
            {newKind === 'team_role' && (
              <Select value={newRole} onValueChange={(v) => setNewRole(v as TeamRole)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {TEAM_ROLE_LABEL[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {newKind === 'team' && (
              <Select value={newWorkTeam} onValueChange={setNewWorkTeam}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Don't link a work team yet</SelectItem>
                  {linkableWorkTeams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      Link to {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChild()}
                placeholder={newKind === 'team_role' ? TEAM_ROLE_LABEL[newRole] : newKind === 'team' ? 'Team name, e.g. FOXTROT' : 'Title, e.g. Recruiter'}
                className="h-9 text-sm"
              />
              <Button size="sm" onClick={addChild} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Add
              </Button>
            </div>
          </Section>
        )}

        {/* Delete */}
        {!isRoot && (
          <Section title="Danger zone">
            {!confirmDelete ? (
              <Button
                size="sm"
                variant="outline"
                className="w-fit border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Delete this box
              </Button>
            ) : (
              <div className="grid gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                <p className="text-xs text-foreground">
                  Delete <span className="font-semibold">{node.title}</span>?
                  {node.kind === 'team' && ' The work team itself and its task history are kept.'}
                </p>
                {childCount > 0 ? (
                  <>
                    <Button size="sm" variant="outline" className="h-auto py-2 whitespace-normal" disabled={remove.isPending} onClick={() => doDelete('lift')}>
                      Delete only this box — move its {childCount} box{childCount === 1 ? '' : 'es'} up
                    </Button>
                    <Button size="sm" variant="destructive" className="h-auto py-2 whitespace-normal" disabled={remove.isPending} onClick={() => doDelete('branch')}>
                      Delete this box and everything under it
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => doDelete('lift')}>
                    Yes, delete it
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </Section>
        )}
        </>
        )}
      </div>
    </div>
  )
}
