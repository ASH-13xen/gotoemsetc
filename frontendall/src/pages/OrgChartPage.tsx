import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { toast } from 'sonner'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react'
import { ChevronsDownUp, ChevronsUpDown, Crown, Loader2, Maximize2, Network, Search, UserX, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useOpenEmployeeDirectory } from '@/hooks/useEmployees'
import { useAuth } from '@/hooks/useAuth'
import { useCreateOrgNode, useMoveOrgNode, useOrgChart } from '@/hooks/useOrgChart'
import { OrgCardNode, type OrgCardNodeType } from '@/components/orgChart/OrgCardNode'
import type { OrgNode } from '@/api/orgChart.api'
import { OrgNodePanel, apiErrorMessage } from '@/components/orgChart/OrgNodePanel'
import {
  accentFor,
  ancestorIds,
  avatarGradient,
  buildIndex,
  canMoveUnder,
  childrenOf,
  fullName,
  initials,
  layoutTree,
  ROOT_WIDTH,
} from '@/components/orgChart/orgTree'
import '@/components/orgChart/orgChart.css'

type XY = { x: number; y: number }

const nodeTypes = { orgCard: OrgCardNode }
// Room for the floating toolbar above and the legend below.
const FIT_PADDING = { top: '110px', bottom: '80px', left: '40px', right: '40px' } as const

// Counts up to its value whenever the value changes.
function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(0)
  useEffect(() => {
    const proxy = { v: last.current }
    const tween = gsap.to(proxy, {
      v: value,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = String(Math.round(proxy.v))
      },
    })
    last.current = value
    return () => {
      tween.kill()
    }
  }, [value])
  return <span ref={ref}>0</span>
}

function OrgChartCanvas() {
  const { data, isLoading, isError } = useOrgChart()
  // Everyone can view the chart; only admin can change it.
  const { user } = useAuth()
  const canEdit = user?.role === 'admin'
  const { data: employees = [] } = useOpenEmployeeDirectory()
  const move = useMoveOrgNode()
  const create = useCreateOrgNode()
  const flow = useReactFlow()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const nodes = useMemo(() => data?.nodes ?? [], [data])
  const index = useMemo(() => buildIndex(nodes), [nodes])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [drop, setDrop] = useState<{ id: string; valid: boolean } | null>(null)

  // ---- Search: matching boxes, plus the path from each up to the top ----
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return new Set<string>()
    return new Set(
      nodes
        .filter((n) => n.title.toLowerCase().includes(q) || n.assignees.some((a) => fullName(a).toLowerCase().includes(q)))
        .map((n) => n._id)
    )
  }, [nodes, q])
  const pathIds = useMemo(() => {
    const out = new Set<string>()
    for (const id of matches) ancestorIds(index, id).forEach((a) => out.add(a))
    return out
  }, [matches, index])

  // Matches are never hidden inside a collapsed branch.
  const effectiveCollapsed = useMemo(() => {
    if (pathIds.size === 0) return collapsed
    return new Set([...collapsed].filter((id) => !pathIds.has(id)))
  }, [collapsed, pathIds])

  const laid = useMemo(() => layoutTree(index, effectiveCollapsed), [index, effectiveCollapsed])
  const layoutKey = laid.map((l) => `${l.node._id}:${Math.round(l.x)},${Math.round(l.y)},${l.height}`).join('|')

  // ---- Animated positions: every relayout glides; new boxes grow out of
  // their nearest visible ancestor. Edges follow because positions are
  // React Flow state, not CSS. ----
  const [positions, setPositions] = useState<Record<string, XY>>({})
  const positionsRef = useRef(positions)
  positionsRef.current = positions
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const firstLayout = useRef(true)

  const targets = useMemo(() => Object.fromEntries(laid.map((l) => [l.node._id, { x: l.x, y: l.y }])), [layoutKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const animateTo = useCallback(
    (to: Record<string, XY>) => {
      tweenRef.current?.kill()
      const from: Record<string, XY> = {}
      for (const id of Object.keys(to)) {
        let start = positionsRef.current[id]
        if (!start) {
          const ancestor = ancestorIds(index, id).find((a) => positionsRef.current[a])
          start = ancestor ? positionsRef.current[ancestor] : to[id]
        }
        from[id] = start
      }
      const proxy = { t: 0 }
      tweenRef.current = gsap.to(proxy, {
        t: 1,
        duration: 0.7,
        ease: 'power3.inOut',
        onUpdate: () => {
          const next: Record<string, XY> = {}
          for (const id of Object.keys(to)) {
            next[id] = {
              x: from[id].x + (to[id].x - from[id].x) * proxy.t,
              y: from[id].y + (to[id].y - from[id].y) * proxy.t,
            }
          }
          setPositions(next)
        },
      })
    },
    [index]
  )

  useEffect(() => {
    if (laid.length === 0) return
    if (firstLayout.current) {
      firstLayout.current = false
      setPositions(targets)
      requestAnimationFrame(() => {
        // Too small to read when everything fits? Open readable instead,
        // anchored on the top box — the rest of the tree is a pan away.
        flow.fitView({ padding: FIT_PADDING, duration: 0 }).then(() => {
          const root = index.root
          const width = canvasRef.current?.clientWidth ?? 0
          if (root && width && flow.getViewport().zoom < 0.7) {
            const zoom = 0.75
            const pos = targets[root._id]
            flow.setViewport({ zoom, x: width / 2 - (pos.x + ROOT_WIDTH / 2) * zoom, y: 120 - pos.y * zoom })
          }
        })
        gsap.fromTo(
          '.org-canvas .org-card',
          { opacity: 0, y: 34, scale: 0.86 },
          // clearProps hands opacity back to the card's own classes (search
          // dimming) once the entrance is done.
          { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.022, clearProps: 'opacity,transform' }
        )
        gsap.fromTo('.org-canvas .react-flow__edge-path', { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.35 })
      })
      return
    }
    animateTo(targets)
  }, [targets]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!toolbarRef.current) return
    gsap.fromTo(toolbarRef.current.children, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: 'power3.out' })
  }, [isLoading])

  // Bring search results into view once the relayout has settled.
  useEffect(() => {
    if (matches.size === 0) return
    const timer = setTimeout(() => {
      flow.fitView({ nodes: [...matches].map((id) => ({ id })), padding: 0.5, duration: 700, maxZoom: 1.1 })
    }, 750)
    return () => clearTimeout(timer)
  }, [matches, flow])

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const teamSummary = useCallback(
    (teamId: string) => {
      const roles = childrenOf(index, teamId).filter((c) => c.kind === 'team_role')
      const people = new Map<string, OrgNode['assignees'][number]>()
      roles.forEach((r) => r.assignees.forEach((a) => people.set(a._id, a)))
      return { people: [...people.values()], rolesFilled: roles.filter((r) => r.assignees.length > 0).length, rolesTotal: roles.length }
    },
    [index]
  )

  // ---- React Flow nodes & edges ----
  const visible = useMemo(() => new Set(laid.map((l) => l.node._id)), [laid])
  const rfNodes: OrgCardNodeType[] = useMemo(
    () =>
      [...laid]
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((l) => ({
          id: l.node._id,
          type: 'orgCard' as const,
          position: positions[l.node._id] ?? { x: l.x, y: l.y },
          width: l.width,
          height: l.height,
          draggable: canEdit && Boolean(l.node.parent),
          selectable: false,
          data: {
            org: l.node,
            accent: accentFor(index, l.node),
            width: l.width,
            height: l.height,
            childCount: childrenOf(index, l.node._id).length,
            collapsed: effectiveCollapsed.has(l.node._id),
            selected: selectedId === l.node._id,
            highlight: matches.has(l.node._id) ? 'match' : pathIds.has(l.node._id) ? 'path' : null,
            dimmed: Boolean(q) && !matches.has(l.node._id) && !pathIds.has(l.node._id),
            dropTarget: drop?.id === l.node._id ? (drop.valid ? 'valid' : 'invalid') : null,
            team: l.node.kind === 'team' ? teamSummary(l.node._id) : undefined,
            teamName: l.node.kind === 'team_role' && l.node.parent ? index.byId.get(l.node.parent)?.title : undefined,
            onToggle: toggle,
          },
        })),
    [laid, positions, index, effectiveCollapsed, selectedId, matches, pathIds, q, drop, toggle, teamSummary, canEdit]
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      laid
        .filter((l) => l.node.parent && visible.has(l.node.parent))
        .map((l) => {
          const isRole = l.node.kind === 'team_role'
          const onPath = Boolean(q) && (matches.has(l.node._id) || pathIds.has(l.node._id))
          const accent = accentFor(index, l.node)
          return {
            id: `e-${l.node.parent}-${l.node._id}`,
            source: l.node.parent as string,
            target: l.node._id,
            sourceHandle: isRole ? 'rail' : undefined,
            targetHandle: isRole ? 'left' : undefined,
            type: 'smoothstep',
            pathOptions: { borderRadius: isRole ? 10 : 18 },
            className: onPath ? 'org-edge-path' : undefined,
            style: onPath
              ? { stroke: accent.from, strokeWidth: 2.6 }
              : isRole
                ? { stroke: accent.from, strokeOpacity: 0.5 }
                : undefined,
            zIndex: onPath ? 5 : 0,
          }
        }),
    [laid, visible, q, matches, pathIds, index]
  )

  // ---- Interactions ----
  const onNodesChange = useCallback((changes: NodeChange<OrgCardNodeType>[]) => {
    setPositions((prev) => {
      let next = prev
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          if (next === prev) next = { ...prev }
          next[change.id] = change.position
        }
      }
      return next
    })
  }, [])

  const onNodeClick: NodeMouseHandler<OrgCardNodeType> = useCallback((_, node) => setSelectedId(node.id), [])

  const onNodeDrag: OnNodeDrag<OrgCardNodeType> = useCallback(
    (_, dragged) => {
      tweenRef.current?.kill()
      const draggedOrg = index.byId.get(dragged.id)
      const hit = flow.getIntersectingNodes(dragged).find((n) => n.id !== dragged.id)
      if (!draggedOrg || !hit || hit.id === draggedOrg.parent) return setDrop(null)
      const target = index.byId.get(hit.id)
      setDrop({ id: hit.id, valid: Boolean(target && canMoveUnder(index, draggedOrg, target)) })
    },
    [flow, index]
  )

  const onNodeDragStop: OnNodeDrag<OrgCardNodeType> = useCallback(
    async (_, dragged) => {
      const target = drop?.valid ? index.byId.get(drop.id) : null
      const draggedOrg = index.byId.get(dragged.id)
      setDrop(null)
      if (!target || !draggedOrg?.parent) {
        animateTo(targets) // snap back
        return
      }
      const previous = { parent: draggedOrg.parent, order: draggedOrg.order }
      try {
        await move.mutateAsync({ id: draggedOrg._id, parent: target._id })
        setCollapsed((prev) => {
          const next = new Set(prev)
          next.delete(target._id)
          return next
        })
        toast.success(`Moved "${draggedOrg.title}" under ${target.title}`, {
          action: {
            label: 'Undo',
            onClick: () =>
              move
                .mutateAsync({ id: draggedOrg._id, ...previous })
                .then(() => toast.success('Move undone'))
                .catch((err) => toast.error(apiErrorMessage(err, 'Could not undo'))),
          },
        })
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not move the box'))
        animateTo(targets)
      }
    },
    [drop, index, move, animateTo, targets]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- Stats ----
  const stats = useMemo(() => {
    const placed = new Set<string>()
    let vacant = 0
    for (const n of nodes) {
      n.assignees.forEach((a) => placed.add(a._id))
      // A team box is a container, not a seat — only its role boxes count.
      if (n.assignees.length === 0 && n.kind !== 'team') vacant += 1
    }
    const unplaced = employees.filter((e) => !placed.has(e._id))
    return { boxes: nodes.length, people: placed.size, vacant, unplaced }
  }, [nodes, employees])

  const teams = useMemo(() => nodes.filter((n) => n.kind === 'team').sort((a, b) => a.order - b.order), [nodes])
  const selected = selectedId ? index.byId.get(selectedId) ?? null : null

  const focusTeam = (teamId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.delete(teamId)
      return next
    })
    setTimeout(() => {
      const ids = [teamId, ...childrenOf(index, teamId).map((c) => c._id)]
      flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.35, duration: 700, maxZoom: 1.15 })
    }, 750)
  }

  // ---- States ----
  if (isLoading) {
    return (
      <div className="org-canvas flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Loading the organisation…</p>
        </div>
      </div>
    )
  }
  if (isError) {
    return (
      <div className="org-canvas flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Could not load the organisation chart.</p>
      </div>
    )
  }
  if (!index.root) {
    return (
      <div className="org-canvas flex h-full items-center justify-center">
        <div className="org-glass flex max-w-sm flex-col items-center gap-4 rounded-3xl p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
            <Crown className="size-7 text-white" />
          </span>
          <div>
            <h2 className="text-xl font-black tracking-tight">{canEdit ? 'Start your organisation' : 'No organisation chart yet'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {canEdit ? 'Create the top box — everything else hangs off it.' : 'It will appear here once the admin sets it up.'}
            </p>
          </div>
          {canEdit && (
          <Button
            disabled={create.isPending}
            onClick={() =>
              create
                .mutateAsync({ title: 'Admin', description: 'Top of the organisation' })
                .catch((err) => toast.error(apiErrorMessage(err, 'Could not create the top box')))
            }
          >
            Create the top box
          </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={canvasRef} className="org-canvas relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={() => setSelectedId(null)}
        nodesConnectable={false}
        nodesDraggable={canEdit}
        // A click that wobbles a few pixels still opens the box instead of
        // starting a drag.
        nodeDragThreshold={6}
        elementsSelectable={false}
        minZoom={0.12}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="color-mix(in oklch, var(--muted-foreground) 35%, transparent)" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeBorderRadius={10}
          nodeColor={(n) => (n.data as { accent?: { from: string } })?.accent?.from ?? '#6366f1'}
          maskColor="color-mix(in oklch, var(--background) 70%, transparent)"
          style={{ width: 180, height: 120, marginRight: selected ? 412 : 16 }}
        />
        <Controls position="bottom-left" showInteractive={false} style={{ marginBottom: 72 }} />
      </ReactFlow>

      {/* Toolbar */}
      <div ref={toolbarRef} className="pointer-events-none absolute top-4 left-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-start gap-3">
        <div className="org-glass pointer-events-auto flex items-center gap-3 rounded-2xl py-2.5 pr-4 pl-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-md">
            <Network className="size-5 text-white" />
          </span>
          <div>
            <h1 className="text-base leading-tight font-black tracking-tight">Organisation</h1>
            <p className="text-[11px] text-muted-foreground">
              {canEdit ? 'Click a box to edit · drag a box onto another to move it' : 'Click a box to see who is in it'}
            </p>
          </div>
        </div>

        <div className="org-glass pointer-events-auto flex items-stretch divide-x divide-border rounded-2xl">
          {[
            { label: 'Boxes', value: stats.boxes, tone: 'text-foreground' },
            { label: 'People placed', value: stats.people, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Vacant', value: stats.vacant, tone: 'text-amber-600 dark:text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2">
              <p className={cn('text-lg leading-none font-black tabular-nums', s.tone)}>
                <AnimatedNumber value={s.value} />
              </p>
              <p className="mt-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{s.label}</p>
            </div>
          ))}
          {canEdit && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="px-4 py-2 text-left transition-colors hover:bg-secondary/50">
                <p className="text-lg leading-none font-black text-rose-600 tabular-nums dark:text-rose-400">
                  <AnimatedNumber value={stats.unplaced.length} />
                </p>
                <p className="mt-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Not on chart</p>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <p className="flex items-center gap-1.5 px-2 pt-1 pb-2 text-xs font-semibold text-muted-foreground">
                <UserX className="size-3.5" />
                Active employees without a box
              </p>
              <div className="max-h-72 space-y-0.5 overflow-y-auto">
                {stats.unplaced.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Everyone is on the chart.</p>
                ) : (
                  stats.unplaced.map((e) => (
                    <div key={e._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                      <span
                        className="flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                        style={{ background: avatarGradient(e._id) }}
                      >
                        {initials(e)}
                      </span>
                      <span className="truncate text-xs font-medium capitalize">{fullName(e).toLowerCase()}</span>
                      <span className="ml-auto truncate text-[10px] text-muted-foreground capitalize">{(e.designation ?? '').toLowerCase()}</span>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          )}
        </div>

        <div className="org-glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a person or box…"
              className="h-9 w-56 rounded-xl bg-secondary/60 pr-8 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {q && (
            <span className="px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {matches.size} match{matches.size === 1 ? '' : 'es'}
            </span>
          )}
          <Button size="sm" variant="ghost" title="Fit to screen" onClick={() => flow.fitView({ padding: FIT_PADDING, duration: 700 })}>
            <Maximize2 className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" title="Expand everything" onClick={() => setCollapsed(new Set())}>
            <ChevronsUpDown className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" title="Collapse all teams" onClick={() => setCollapsed(new Set(teams.map((t) => t._id)))}>
            <ChevronsDownUp className="size-4" />
          </Button>
        </div>
      </div>

      {/* Team legend — click to fly to a team */}
      {teams.length > 0 && (
        <div className="org-glass absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5">
          {teams.map((team) => {
            const accent = accentFor(index, team)
            return (
              <button
                key={team._id}
                type="button"
                onClick={() => focusTeam(team._id)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-secondary"
              >
                <span className="size-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }} />
                {team.title}
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <OrgNodePanel
          key={selected._id}
          node={selected}
          index={index}
          employees={employees}
          linkableWorkTeams={data?.linkableWorkTeams ?? []}
          readOnly={!canEdit}
          onClose={() => setSelectedId(null)}
          onSelect={setSelectedId}
        />
      )}
    </div>
  )
}

export default function OrgChartPage() {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <OrgChartCanvas />
      </ReactFlowProvider>
    </div>
  )
}
