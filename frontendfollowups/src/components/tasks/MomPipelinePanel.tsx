import { useState } from 'react'
import { TriangleAlert, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PipelineStepper } from './PipelineStepper'
import { useMomPipelineAdvance, useMomPipelineReject, useMomPipelineSendBack } from '@/hooks/useEmployeeTasks'
import type { EmployeeTask, MomPipelineView } from '@/api/employeeTasks.api'

// A MOM-spawned pipeline task's own stepper + actions — the off-calendar
// sibling of the CMS calendar's ItemPanel. canAct (resolved server-side,
// same actor logic as the real pipeline) drives whether the buttons show
// at all; the server re-checks regardless.
export function MomPipelinePanel({ task, view }: { task: EmployeeTask; view: MomPipelineView }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  const advance = useMomPipelineAdvance(task._id)
  const sendBack = useMomPipelineSendBack(task._id)
  const reject = useMomPipelineReject(task._id)

  const kindLabel = task.momPipeline?.kind === 'custom' ? 'Custom pipeline' : task.momPipeline?.kind === 'reel' ? 'Reel' : 'Post'

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">MOM pipeline — {kindLabel}</p>
      <PipelineStepper trail={view.trail} isSentBack={task.momPipeline?.isSentBack} isRejected={task.momPipeline?.isRejected} />

      {view.canAct && !task.momPipeline?.isRejected && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => advance.mutate()} disabled={advance.isPending}>
            Mark done
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendBack.mutate()}
            disabled={sendBack.isPending}
            style={{ borderColor: '#f9a8d4', color: '#be185d' }}
          >
            <Undo2 className="mr-1.5 size-3.5" />
            Send back
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}

      {rejecting && (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          {!confirming ? (
            <>
              <Textarea rows={2} placeholder="Why is this being rejected?" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setRejecting(false); setReason('') }}>Cancel</Button>
                <Button size="sm" variant="destructive" disabled={!reason.trim()} onClick={() => setConfirming(true)}>Continue</Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>Are you sure? This closes the task permanently — it cannot be reopened.</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Back</Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={reject.isPending}
                  onClick={() => reject.mutate(reason, { onSuccess: () => { setRejecting(false); setConfirming(false); setReason('') } })}
                >
                  {reject.isPending ? 'Rejecting…' : 'Yes, reject it'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
