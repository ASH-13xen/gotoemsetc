import { createContext, useContext } from 'react'
import { Check, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAcknowledgeAction, useActionAcks, useRestoreAction } from '@/hooks/useActionAcks'
import { cn } from '@/lib/utils'

// "Acknowledge" in the Action centre. Each card shows its items through a
// scope: "open" shows what this person hasn't acknowledged (with an
// Acknowledge button), "acked" shows what they have (with Bring back). A
// notice (a mail that failed, who joined or left, a bill) is simply gone once
// acknowledged; something still waiting for their decision moves to the
// centre's Acknowledged list, where it can still be decided.

type Mode = 'open' | 'acked'
const EMPTY = new Set<string>()
const AckContext = createContext<{ mode: Mode; acked: Set<string> }>({ mode: 'open', acked: EMPTY })

export function AckScope({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  const { acked } = useActionAcks()
  return <AckContext.Provider value={{ mode, acked }}>{children}</AckContext.Provider>
}

export function useAckScope() {
  const { mode, acked } = useContext(AckContext)
  return {
    mode,
    // Whether an item belongs in this scope.
    shows: (key: string) => (mode === 'open' ? !acked.has(key) : acked.has(key)),
    // Notices only ever show while unacknowledged.
    notices: mode === 'open',
  }
}

export function AckButton({ keys, notice = false, className }: { keys: string[]; notice?: boolean; className?: string }) {
  const { mode } = useAckScope()
  const ack = useAcknowledgeAction()
  const restore = useRestoreAction()
  if (!keys.length) return null
  const back = mode === 'acked'
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn('h-8 shrink-0 gap-1 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground', className)}
      disabled={ack.isPending || restore.isPending}
      onClick={() => (back ? restore.mutate(keys) : ack.mutate(keys))}
      title={
        back
          ? 'Put it back in the Action centre list'
          : notice
            ? 'Acknowledge — it goes away'
            : "Acknowledge — it leaves your list and count (it stays under Acknowledged until it's decided)"
      }
    >
      {back ? <Undo2 className="size-3.5" /> : <Check className="size-3.5" />}
      {back ? 'Bring back' : 'Acknowledge'}
    </Button>
  )
}
