import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// Animates a stat number counting up into view instead of popping in.
// No-ops while `value` is still loading (undefined).
export function useCountUp(value: number | undefined, duration = 0.8) {
  const ref = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      if (value === undefined || !ref.current) return
      const counter = { current: 0 }
      gsap.to(counter, {
        current: value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          if (ref.current) ref.current.textContent = Math.round(counter.current).toLocaleString()
        },
      })
    },
    { dependencies: [value] }
  )

  return ref
}
