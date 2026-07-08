import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  useCreateCredential,
  useDeleteCredential,
  useEmployeeCredential,
  useUpdateCredential,
} from '@/hooks/useCredentials'

function slugifyUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

export function CredentialsDialog({
  employeeId,
  employeeName,
  trigger,
}: {
  employeeId: string
  employeeName: string
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const { data, isLoading } = useEmployeeCredential(employeeId)
  const credential = data?.credential
  const createCredential = useCreateCredential(employeeId)
  const updateCredential = useUpdateCredential(employeeId)
  const deleteCredential = useDeleteCredential(employeeId)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setUsername(credential?.username ?? slugifyUsername(employeeName))
  }, [open, credential, employeeName])

  const onCreate = () => {
    if (!username.trim() || !password) {
      toast.error('Username and password are required')
      return
    }
    createCredential.mutate(
      { username: username.trim(), password },
      {
        onSuccess: () => toast.success('Credentials created'),
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Could not create credentials'
          toast.error(message)
        },
      }
    )
  }

  const onSave = () => {
    if (!credential) return
    updateCredential.mutate(
      { userId: credential._id, username: username.trim(), password: password || undefined },
      {
        onSuccess: () => {
          toast.success('Credentials updated')
          setPassword('')
        },
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Could not update credentials'
          toast.error(message)
        },
      }
    )
  }

  const onRevoke = () => {
    if (!credential) return
    if (!window.confirm(`Revoke ${credential.username}'s login access?`)) return
    deleteCredential.mutate(credential._id, {
      onSuccess: () => toast.success('Access revoked'),
      onError: () => toast.error('Could not revoke access'),
    })
  }

  const isBusy = createCredential.isPending || updateCredential.isPending || deleteCredential.isPending
  const hasActiveCredential = credential && credential.isActive

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            {hasActiveCredential ? 'Manage Login Credentials' : 'Add Login Credentials'}
          </DialogTitle>
          <DialogDescription>
            {hasActiveCredential
              ? 'This grants worker-level access to the platform — same permissions as any other worker.'
              : credential
                ? 'This employee has revoked credentials. Set a new password to reactivate, or change the username.'
                : 'Creates a login for this employee with worker-level access — same permissions as any other worker.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cred-username">Username</Label>
              <Input id="cred-username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cred-password">
                {credential ? 'New password' : 'Password'}
                {credential && <span className="font-normal text-muted-foreground"> (leave blank to keep current)</span>}
              </Label>
              <Input
                id="cred-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {credential && (
            <Button type="button" variant="destructive" onClick={onRevoke} disabled={isBusy}>
              {deleteCredential.isPending && <Loader2 className="size-4 animate-spin" />}
              Revoke Access
            </Button>
          )}
          <Button type="button" onClick={credential ? onSave : onCreate} disabled={isBusy || isLoading}>
            {(createCredential.isPending || updateCredential.isPending) && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {credential ? 'Save Changes' : 'Create Credentials'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
