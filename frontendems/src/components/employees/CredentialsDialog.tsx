import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Info, KeyRound, Loader2 } from 'lucide-react'

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
import { PERMISSION_OPTIONS, type Permission } from '@/api/credentials.api'
import { useAuth } from '@/hooks/useAuth'
import { isAdminLike } from '@/lib/permissions'
import { useWorkTeams } from '@/hooks/useWorkTeams'
import { extractApiErrorMessage } from '@/lib/errors'

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
  const [permissions, setPermissions] = useState<Permission[]>([])

  const { user: actingUser } = useAuth()
  const isAdmin = isAdminLike(actingUser)
  // A non-admin add_credentials holder can only ever grant permissions they
  // themselves have — matches the backend's assertNoEscalation guard.
  const grantableOptions = isAdmin
    ? PERMISSION_OPTIONS
    : PERMISSION_OPTIONS.filter((opt) => actingUser?.permissions?.includes(opt.value))
  // Grouped options (e.g. "Task Management") rendered as their own labeled
  // sub-section below the ungrouped list, which keeps its exact original markup.
  const groupedOptions = Array.from(
    grantableOptions
      .filter((opt) => opt.group)
      .reduce((map, opt) => {
        const list = map.get(opt.group as string) ?? []
        list.push(opt)
        map.set(opt.group as string, list)
        return map
      }, new Map<string, typeof grantableOptions>())
  )

  // A team leader (Task Management, frontendfollowups) gets real
  // task-creation/edit authority for their own team dynamically — not
  // through manage_tasks/manage_subtasks — so those checkboxes can look
  // unchecked here even though the person already has task authority. See
  // backend/src/middlewares/taskAccess.middleware.js#requireCanCreateTopLevelTask.
  const { data: workTeamsData } = useWorkTeams()
  const ledTeams = (workTeamsData?.teams ?? []).filter((t) => t.leader._id === employeeId)

  const { data, isLoading } = useEmployeeCredential(employeeId)
  const credential = data?.credential
  const createCredential = useCreateCredential(employeeId)
  const updateCredential = useUpdateCredential(employeeId)
  const deleteCredential = useDeleteCredential(employeeId)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setUsername(credential?.username ?? slugifyUsername(employeeName))
    setPermissions(credential?.permissions ?? [])
  }, [open, credential, employeeName])

  const togglePermission = (perm: Permission) => {
    setPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]))
  }

  const onCreate = () => {
    if (!username.trim() || !password) {
      toast.error('Username and password are required')
      return
    }
    createCredential.mutate(
      { username: username.trim(), password, permissions },
      {
        onSuccess: () => toast.success('Credentials created'),
        onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not create credentials')),
      }
    )
  }

  const onSave = () => {
    if (!credential) return
    updateCredential.mutate(
      {
        userId: credential._id,
        username: username.trim(),
        password: password || undefined,
        // Only admins may edit an existing credential's permissions — the
        // backend silently ignores this field from anyone else.
        permissions: isAdmin ? permissions : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Credentials updated')
          setPassword('')
        },
        onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not update credentials')),
      }
    )
  }

  const onRevoke = () => {
    if (!credential) return
    if (!window.confirm(`Revoke ${credential.username}'s login access?`)) return
    deleteCredential.mutate(credential._id, {
      onSuccess: () => toast.success('Access revoked'),
      onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not revoke access')),
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
              ? 'By default this only grants read-only access to their own record — tick any extra permissions below to give them more.'
              : credential
                ? 'This employee has revoked credentials. Set a new password to reactivate, or change the username.'
                : 'Creates a login for this employee. By default they can only view their own record — tick any extra permissions below to give them more.'}
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
            {ledTeams.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-xs text-foreground/80">
                <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p>
                  Also leads: <span className="font-semibold">{ledTeams.map((t) => t.name).join(', ')}</span>. Team
                  leaders can create/edit Task Management tasks for their own team regardless of the checkboxes
                  below — that's separate from Manage Tasks/Manage Subtasks, which grant it org-wide.
                </p>
              </div>
            )}
            {(isAdmin || !credential) && (
              <div className="grid gap-1.5">
                <Label>Permissions</Label>
                {grantableOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    You don't hold any permissions yourself, so you can't grant any.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-2 rounded-xl border border-border/40 p-3">
                      {grantableOptions
                        .filter((opt) => !opt.group)
                        .map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 cursor-pointer select-none text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={permissions.includes(opt.value)}
                              onChange={() => togglePermission(opt.value)}
                              className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                            />
                            {opt.label}
                          </label>
                        ))}
                    </div>
                    {groupedOptions.map(([group, options]) => (
                      <div key={group} className="grid gap-2 rounded-xl border border-border/40 p-3">
                        <p className="text-xs font-medium text-muted-foreground">{group}</p>
                        {options.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 cursor-pointer select-none text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={permissions.includes(opt.value)}
                              onChange={() => togglePermission(opt.value)}
                              className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            {!isAdmin && credential && (
              <p className="text-xs text-muted-foreground">
                Only an admin can change permissions on an existing credential.
              </p>
            )}
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
