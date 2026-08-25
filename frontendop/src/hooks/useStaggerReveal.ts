import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// Staggers the direct children of the returned container into view once per
// dependency change — used on table bodies / list panels so a page of rows
// doesn't just pop in when data loads.
export function useStaggerReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const containerRef = useRef<T>(null)

  useGSAP(
    () => {
      const children = containerRef.current?.children
      if (!children || children.length === 0) return
      gsap.from(children, {
        opacity: 0,
        y: 8,
        duration: 0.35,
        stagger: 0.03,
        ease: 'power2.out',
      })
    },
    { dependencies: deps }
  )

  return containerRef
}
