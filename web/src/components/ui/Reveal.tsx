import { useEffect, useRef, useState } from 'react'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

type Direction = 'up' | 'left' | 'right' | 'none'

interface Props extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  /** Seconds to stagger this element behind its neighbours. */
  delay?: number
  direction?: Direction
  as?: ElementType
  className?: string
}

const OFFSET: Record<Direction, string> = {
  up: 'translate3d(0, 28px, 0)',
  left: 'translate3d(-28px, 0, 0)',
  right: 'translate3d(28px, 0, 0)',
  none: 'none',
}

/**
 * Fades and slides its children in the first time they scroll into view.
 *
 * Uses IntersectionObserver directly to avoid pulling an animation library
 * into the bundle. Falls back to the visible state when the API is missing or
 * the visitor asked for reduced motion, so content is never trapped at
 * opacity 0.
 */
export function Reveal({
  children,
  delay = 0,
  direction = 'up',
  as: Tag = 'div',
  className = '',
  ...rest
}: Props) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (!node || reduceMotion || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      {...rest}
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : OFFSET[direction],
        transition: `opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  )
}
