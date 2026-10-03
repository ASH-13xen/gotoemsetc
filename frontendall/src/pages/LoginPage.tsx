import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
} from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import gsap from 'gsap'
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  Eye,
  EyeOff,
  ListChecks,
  Lock,
  Settings2,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth, useLogin } from '@/hooks/useAuth'
import './LoginPage.css'

/* The six workspaces this shell actually federates — same labels as ShellNav,
   so the panel never advertises a module that does not exist. */
const MODULES = [
  { label: 'EMS', Icon: Users },
  { label: 'Sales', Icon: TrendingUp },
  { label: 'Task Management', Icon: ListChecks },
  { label: 'HRMS', Icon: BriefcaseBusiness },
  { label: 'Operations', Icon: Settings2 },
  { label: 'Finance', Icon: Wallet },
]

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const { token } = useAuth()
  const loginMutation = useLogin()

  const rootRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const shineRef = useRef<HTMLSpanElement>(null)

  /* Entrance + ambient motion. useLayoutEffect (not useEffect) so the `from`
     states are committed before the browser's first paint — otherwise the
     final layout flashes for a frame before the timeline rewinds it. */
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } })

      tl.fromTo(
        '.login-brand-wipe',
        { xPercent: 0 },
        { xPercent: 101, duration: 0.95, ease: 'power4.inOut' },
        0
      )
        .from('.login-mark', { y: 18, opacity: 0 }, 0.45)
        .from('.login-headline', { y: 26, opacity: 0 }, 0.55)
        .from('.login-sub', { y: 18, opacity: 0 }, 0.65)
        .from('.login-module', { y: 16, opacity: 0, scale: 0.96, stagger: 0.06 }, 0.72)
        .from('.login-foot', { opacity: 0 }, 0.95)
        .from(
          [
            '.login-eyebrow',
            '.login-title',
            '.login-hint',
            '.login-field',
            '.login-submit',
            '.login-legal',
          ],
          { y: 14, opacity: 0, stagger: 0.07 },
          0.35
        )

      const drift = { repeat: -1, yoyo: true, ease: 'sine.inOut' } as const
      gsap.to('.login-orb-a', { x: 40, y: -30, scale: 1.12, duration: 9, ...drift })
      gsap.to('.login-orb-b', { x: -50, y: 40, scale: 1.08, duration: 11, ...drift })
      gsap.to('.login-orb-c', { x: 30, y: 50, scale: 1.15, duration: 13, ...drift })
      gsap.fromTo(
        '.login-beam',
        { xPercent: -60, rotate: 18 },
        { xPercent: 320, rotate: 18, duration: 7, ease: 'none', repeat: -1, delay: 1 }
      )
    }, root)

    return () => ctx.revert()
  }, [])

  /* Cursor parallax on the dark panel. Moves the orb *container* and the grid,
     never the orbs themselves — those are owned by the drift tweens above. */
  useEffect(() => {
    const brand = rootRef.current?.querySelector<HTMLElement>('.login-brand')
    if (!brand || prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) {
      return
    }

    function handleMove(e: MouseEvent) {
      const rect = brand!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      gsap.to('.login-orbs', {
        x: nx * 36,
        y: ny * 36,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
      })
      gsap.to('.login-grid', {
        x: nx * -24,
        y: ny * -24,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
      })
    }

    brand.addEventListener('mousemove', handleMove)
    return () => brand.removeEventListener('mousemove', handleMove)
  }, [])

  /* Shake the form on a rejected credential. */
  useEffect(() => {
    if (!loginMutation.isError || !formRef.current || prefersReducedMotion()) return
    gsap.fromTo(
      formRef.current,
      { x: -8 },
      { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.35)' }
    )
  }, [loginMutation.isError])

  if (token) {
    return <Navigate to="/" replace />
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    loginMutation.mutate(
      { username, password },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: () => toast.error('Invalid username or password'),
      }
    )
  }

  function sweepShine() {
    if (!shineRef.current || prefersReducedMotion()) return
    gsap.fromTo(
      shineRef.current,
      { xPercent: -120, skewX: -18 },
      { xPercent: 320, skewX: -18, duration: 0.7, ease: 'power2.out' }
    )
  }

  function lift(e: FocusEvent<HTMLInputElement>, up: boolean) {
    if (prefersReducedMotion()) return
    const wrap = e.currentTarget.closest('.login-input-wrap')
    if (wrap) gsap.to(wrap, { scale: up ? 1.01 : 1, duration: 0.2, ease: 'power2.out' })
  }

  return (
    <div className="login-root" ref={rootRef}>
      <section className="login-brand">
        <div className="login-brand-base" />
        <div className="login-grid" />
        <div className="login-orbs">
          <div className="login-orb login-orb-a" />
          <div className="login-orb login-orb-b" />
          <div className="login-orb login-orb-c" />
        </div>
        <div className="login-beam" />
        <div className="login-noise" />
        <div className="login-brand-wipe" />

        <div className="login-mark">
          <span className="login-logo">
            <Building2 size={20} />
          </span>
          <span className="login-wordmark">CRM Platform</span>
        </div>

        <div className="login-brand-body">
          <h1 className="login-headline">
            Less busywork.
            <span className="login-headline-accent">More business.</span>
          </h1>
          <p className="login-sub">
            HR, finance, sales, and operations — all working off the same information, all in
            one place. Built so your team spends less time on paperwork and more time on the
            work that matters.
          </p>
          <div className="login-modules">
            {MODULES.map(({ label, Icon }) => (
              <div className="login-module" key={label}>
                <Icon size={16} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-foot">v1.3 · © 2026 CRM Platform. All rights reserved.</div>
      </section>

      <section className="login-panel">
        <div className="login-panel-wash" />
        <div className="login-form-col">
          <p className="login-eyebrow">Welcome back</p>
          <h2 className="login-title">Sign in to your account</h2>
          <p className="login-hint">Use the credentials issued by your administrator.</p>

          <form onSubmit={handleSubmit} className="login-form" ref={formRef}>
            <div className="login-field">
              <label className="login-label" htmlFor="username">
                Username
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <User size={16} />
                </span>
                <input
                  id="username"
                  className="login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={(e) => lift(e, true)}
                  onBlur={(e) => lift(e, false)}
                  placeholder="your.username"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="password">
                Password
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="password"
                  className="login-input login-input-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={(e) => lift(e, true)}
                  onBlur={(e) => lift(e, false)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginMutation.isError && (
              <p className="login-error">
                <AlertCircle size={14} />
                Invalid username or password.
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loginMutation.isPending}
              onMouseEnter={sweepShine}
            >
              <span className="login-submit-shine" ref={shineRef} />
              {loginMutation.isPending && <span className="login-spinner" />}
              <span className="login-submit-label">
                {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
              </span>
            </button>
          </form>

          <p className="login-legal">
            Authorised personnel only. Activity on this system is logged.
          </p>
        </div>
      </section>
    </div>
  )
}
