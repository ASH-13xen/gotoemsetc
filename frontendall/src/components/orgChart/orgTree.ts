import type { OrgNode } from '@/api/orgChart.api'

// ---------------------------------------------------------------------------
// Pure tree helpers + layout for the Organisation chart. No React here.
// ---------------------------------------------------------------------------

export interface OrgIndex {
  byId: Map<string, OrgNode>
  children: Map<string, OrgNode[]>
  root: OrgNode | null
}

export function buildIndex(nodes: OrgNode[]): OrgIndex {
  const byId = new Map(nodes.map((n) => [n._id, n]))
  const children = new Map<string, OrgNode[]>()
  let root: OrgNode | null = null
  for (const node of nodes) {
    if (!node.parent) {
      root = node
      continue
    }
    const list = children.get(node.parent) ?? []
    list.push(node)
    children.set(node.parent, list)
  }
  for (const list of children.values()) list.sort((a, b) => a.order - b.order)
  return { byId, children, root }
}

export function childrenOf(index: OrgIndex, id: string) {
  return index.children.get(id) ?? []
}

export function descendantIds(index: OrgIndex, id: string): Set<string> {
  const out = new Set<string>()
  const stack = [...childrenOf(index, id)]
  while (stack.length) {
    const node = stack.pop()!
    out.add(node._id)
    stack.push(...childrenOf(index, node._id))
  }
  return out
}

export function ancestorIds(index: OrgIndex, id: string): string[] {
  const out: string[] = []
  let current = index.byId.get(id)
  while (current?.parent) {
    out.push(current.parent)
    current = index.byId.get(current.parent)
  }
  return out
}

export function depthOf(index: OrgIndex, id: string) {
  return ancestorIds(index, id).length
}

// Can `node` be moved under `target`? Mirrors the server's rules: never
// under itself or its own branch; team roles only directly under a team;
// nothing else directly under a team.
export function canMoveUnder(index: OrgIndex, node: OrgNode, target: OrgNode) {
  if (node._id === target._id || !node.parent) return false
  if (descendantIds(index, node._id).has(target._id)) return false
  if (node.kind === 'team_role') return target.kind === 'team'
  return target.kind !== 'team' && target.kind !== 'team_role'
}

export function fullName(person: { firstName: string; lastName?: string }) {
  return `${person.firstName} ${person.lastName ?? ''}`.trim()
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const CARD_WIDTH = 264
export const ROOT_WIDTH = 300
export const ROLE_WIDTH = 236
export const ROLE_INDENT = 28
const ROLE_GAP = 14
const MAX_VISIBLE_PEOPLE = 3

// Card heights track their content (header + one row per person, capped,
// or the "Vacant" row) so the layout never overlaps.
export function cardHeight(node: OrgNode) {
  // A team box shows a one-line summary of its members, not assignees.
  const rows = node.kind === 'team' ? 1 : Math.min(Math.max(node.assignees.length, 1), MAX_VISIBLE_PEOPLE)
  const more = node.kind !== 'team' && node.assignees.length > MAX_VISIBLE_PEOPLE ? 22 : 0
  const header = node.kind === 'team_role' ? 58 : 70
  return header + rows * 40 + more + 18
}

export const MAX_PEOPLE_ON_CARD = MAX_VISIBLE_PEOPLE

export interface LaidOutNode {
  node: OrgNode
  x: number
  y: number
  width: number
  height: number
}

// Lays out every visible node as a tidy top-down tree that keeps siblings
// in their saved left-to-right order: each subtree is as wide as its
// children (or its own card), parents sit centred over their children, and
// every depth gets a row as tall as its tallest box. Team-role boxes aren't
// laid out as children: each team reserves a tall slot and its roles stack
// in a column beneath the team card (joined by an elbow "rail"), which
// keeps five teams × several roles from spreading thousands of pixels wide.
const SIBLING_GAP = 44
const RANK_GAP = 92

export function layoutTree(index: OrgIndex, collapsed: Set<string>): LaidOutNode[] {
  if (!index.root) return []

  interface Slot {
    node: OrgNode
    depth: number
    width: number
    cardHeight: number
    slotHeight: number
    roles: OrgNode[]
    kids: Slot[]
    subtreeWidth: number
  }

  const build = (node: OrgNode, depth: number): Slot => {
    const width = node.parent ? CARD_WIDTH : ROOT_WIDTH
    const own = cardHeight(node)
    const all = childrenOf(index, node._id)
    const isCollapsed = collapsed.has(node._id)
    const roles = node.kind === 'team' && !isCollapsed ? all.filter((k) => k.kind === 'team_role') : []
    const slotHeight = own + roles.reduce((sum, r) => sum + ROLE_GAP + cardHeight(r), 0)
    const kids = isCollapsed || node.kind === 'team' ? [] : all.map((child) => build(child, depth + 1))
    const childrenWidth = kids.reduce((sum, k) => sum + k.subtreeWidth, 0) + Math.max(0, kids.length - 1) * SIBLING_GAP
    return { node, depth, width, cardHeight: own, slotHeight, roles, kids, subtreeWidth: Math.max(width, childrenWidth) }
  }
  const tree = build(index.root, 0)

  // Row heights per depth.
  const rowHeight: number[] = []
  const measure = (slot: Slot) => {
    rowHeight[slot.depth] = Math.max(rowHeight[slot.depth] ?? 0, slot.slotHeight)
    slot.kids.forEach(measure)
  }
  measure(tree)
  const rowY: number[] = []
  rowHeight.forEach((_, depth) => {
    rowY[depth] = depth === 0 ? 0 : rowY[depth - 1] + rowHeight[depth - 1] + RANK_GAP
  })

  const out: LaidOutNode[] = []
  const place = (slot: Slot, left: number) => {
    const x = left + (slot.subtreeWidth - slot.width) / 2
    const y = rowY[slot.depth]
    out.push({ node: slot.node, x, y, width: slot.width, height: slot.cardHeight })

    let cursor = y + slot.cardHeight
    for (const role of slot.roles) {
      cursor += ROLE_GAP
      const height = cardHeight(role)
      out.push({ node: role, x: x + ROLE_INDENT, y: cursor, width: ROLE_WIDTH, height })
      cursor += height
    }

    const childrenWidth = slot.kids.reduce((sum, k) => sum + k.subtreeWidth, 0) + Math.max(0, slot.kids.length - 1) * SIBLING_GAP
    let childLeft = left + (slot.subtreeWidth - childrenWidth) / 2
    for (const kid of slot.kids) {
      place(kid, childLeft)
      childLeft += kid.subtreeWidth + SIBLING_GAP
    }
  }
  place(tree, 0)
  return out
}

// ---------------------------------------------------------------------------
// Visual identity
// ---------------------------------------------------------------------------

// One accent per team (by sibling order), reused by its role boxes.
const TEAM_PALETTE = [
  { from: '#14b8a6', to: '#0ea5e9', soft: 'rgba(20,184,166,0.12)' }, // teal → sky
  { from: '#f59e0b', to: '#f97316', soft: 'rgba(245,158,11,0.12)' }, // amber → orange
  { from: '#f43f5e', to: '#ec4899', soft: 'rgba(244,63,94,0.12)' }, // rose → pink
  { from: '#8b5cf6', to: '#6366f1', soft: 'rgba(139,92,246,0.12)' }, // violet → indigo
  { from: '#22c55e', to: '#84cc16', soft: 'rgba(34,197,94,0.12)' }, // green → lime
  { from: '#06b6d4', to: '#3b82f6', soft: 'rgba(6,182,212,0.12)' }, // cyan → blue
]
const ROOT_ACCENT = { from: '#6366f1', to: '#a855f7', soft: 'rgba(99,102,241,0.12)' }
const POSITION_ACCENT = { from: '#64748b', to: '#6366f1', soft: 'rgba(99,102,241,0.08)' }
const EXEC_ACCENT = { from: '#0ea5e9', to: '#6366f1', soft: 'rgba(14,165,233,0.1)' }

export type Accent = typeof ROOT_ACCENT

export function accentFor(index: OrgIndex, node: OrgNode): Accent {
  if (!node.parent) return ROOT_ACCENT
  const team = node.kind === 'team' ? node : node.kind === 'team_role' ? index.byId.get(node.parent) : null
  if (team?.parent) {
    const siblings = childrenOf(index, team.parent).filter((n) => n.kind === 'team')
    const i = Math.max(0, siblings.findIndex((s) => s._id === team._id))
    return TEAM_PALETTE[i % TEAM_PALETTE.length]
  }
  return depthOf(index, node._id) === 1 ? EXEC_ACCENT : POSITION_ACCENT
}

// Stable gradient per person for their initials avatar.
const AVATAR_GRADIENTS = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#22d3ee'],
  ['#f43f5e', '#fb7185'],
  ['#f59e0b', '#fbbf24'],
  ['#10b981', '#34d399'],
  ['#ec4899', '#f472b6'],
  ['#8b5cf6', '#c084fc'],
  ['#14b8a6', '#5eead4'],
]

export function avatarGradient(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  const [a, b] = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

export function initials(person: { firstName: string; lastName?: string }) {
  return `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase()
}
