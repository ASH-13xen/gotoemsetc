import { Camera } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  GENUINE_LABEL,
  GENUINE_PARTS,
  GRADE_LABEL,
  PARTS,
  securityItemsFor,
  type CheckInput,
  type DeviceKind,
  type GenuineState,
  type Grade,
  type PartState,
  type Settings,
} from '@/api/devices.api'

// One device check — overall grade, each part, storage, battery, the security
// settings, the apps, gallery backup, photos. Used at handover, at return and
// for HR's own checks (the holder's monthly check is the same form on their
// dashboard).

export function emptyCheck(): CheckInput {
  return { parts: {}, security: {}, apps: [] }
}

const STATES: PartState[] = ['ok', 'worn', 'damaged', 'missing']
const STATE_STYLE: Record<PartState, string> = {
  ok: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/40',
  worn: 'bg-amber-500/15 text-amber-700 ring-amber-500/40',
  damaged: 'bg-destructive/15 text-destructive ring-destructive/40',
  missing: 'bg-zinc-500/15 text-zinc-700 ring-zinc-500/40',
}

export function CheckFields({
  kind,
  os,
  apps,
  value,
  onChange,
  photos,
  onPhotos,
}: {
  kind: DeviceKind
  os?: string | null
  apps: Settings['apps']
  value: CheckInput
  onChange: (next: CheckInput) => void
  photos: File[]
  onPhotos: (files: File[]) => void
}) {
  const set = (patch: Partial<CheckInput>) => onChange({ ...value, ...patch })
  const appState = (key: string) => value.apps.find((a) => a.key === key) ?? { key, installed: false, loggedIn: false }
  const setApp = (key: string, patch: { installed?: boolean; loggedIn?: boolean }) => {
    const next = { ...appState(key), ...patch }
    if (patch.installed === false) next.loggedIn = false
    set({ apps: [...value.apps.filter((a) => a.key !== key), next] })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Overall condition</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(GRADE_LABEL) as Grade[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set({ grade: g })}
              className={cn(
                'rounded-lg border px-2 py-2 text-left text-xs font-medium transition-colors',
                value.grade === g ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary/60'
              )}
            >
              {GRADE_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Parts</Label>
        <div className="grid gap-1.5">
          {PARTS[kind].map((part) => (
            <div key={part.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5">
              <span className="text-sm">{part.label}</span>
              <div className="flex gap-1">
                {STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => set({ parts: { ...value.parts, [part.key]: state } })}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-transparent',
                      value.parts[part.key] === state ? STATE_STYLE[state] : 'text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {os === 'ios' && (
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Parts and Service History — Settings → General → About (a part never replaced is not listed)</Label>
          {GENUINE_PARTS.map((part) => (
            <div key={part.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5">
              <span className="text-sm">{part.label}</span>
              <div className="flex gap-1">
                {(Object.keys(GENUINE_LABEL) as GenuineState[]).map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => set({ genuine: { ...value.genuine, [part.key]: state } })}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-transparent',
                      value.genuine?.[part.key] === state ? (state === 'unknown' ? STATE_STYLE.damaged : STATE_STYLE.ok) : 'text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {GENUINE_LABEL[state]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Storage total (GB)</Label>
          <Input type="number" min="0" value={value.storageTotalGb ?? ''} onChange={(e) => set({ storageTotalGb: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Storage free (GB)</Label>
          <Input type="number" min="0" value={value.storageFreeGb ?? ''} onChange={(e) => set({ storageFreeGb: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Battery health (%)</Label>
          <Input type="number" min="0" max="100" value={value.batteryHealth ?? ''} onChange={(e) => set({ batteryHealth: e.target.value })} />
        </div>
        <p className="col-span-3 -mt-1 text-[11px] text-muted-foreground">
          iPhone: Capacity and Available are in Settings → General → About; battery health is Settings → Battery → Battery Health (Maximum Capacity). Android:
          Settings → Storage, and Settings → Battery.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Security — checked on the device itself</Label>
        {securityItemsFor(kind).map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-1.5">
            <span className="text-sm">{item.label}</span>
            <div className="flex shrink-0 gap-1">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  onClick={() => set({ security: { ...value.security, [item.key]: on } })}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                    value.security[item.key] === on ? (on ? STATE_STYLE.ok : STATE_STYLE.damaged) : 'text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {on ? 'On' : 'Off'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(kind === 'phone' || kind === 'tablet') && (
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Apps — installed, and signed in to the company account</Label>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {apps.map((app) => {
              const s = appState(app.key)
              return (
                <div key={app.key} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {app.label}
                    {!app.required && <span className="ml-1 text-[10px] text-muted-foreground">(optional)</span>}
                  </span>
                  <span className="flex shrink-0 gap-2 text-[11px]">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" className="accent-primary" checked={Boolean(s.installed)} onChange={(e) => setApp(app.key, { installed: e.target.checked })} />
                      Installed
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={Boolean(s.loggedIn)}
                        disabled={!s.installed}
                        onChange={(e) => setApp(app.key, { loggedIn: e.target.checked })}
                      />
                      Signed in
                    </label>
                  </span>
                </div>
              )
            })}
          </div>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={Boolean(value.galleryBackedUp)} onChange={(e) => set({ galleryBackedUp: e.target.checked })} />
            Gallery and shoot footage backed up (Google Photos / Drive)
          </label>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Remarks</Label>
        <Textarea rows={2} value={value.remarks ?? ''} onChange={(e) => set({ remarks: e.target.value })} placeholder="Anything else worth noting" />
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Photos (front, back, any damage) — up to 8</Label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/40">
          <Camera className="size-4" />
          {photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} chosen` : 'Add photos'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => onPhotos([...photos, ...Array.from(e.target.files ?? [])].slice(0, 8))}
          />
        </label>
      </div>
    </div>
  )
}
