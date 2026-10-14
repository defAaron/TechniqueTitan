import { useEffect, useState } from 'react'
import { DonutChart } from '../ui/donut-chart'

const RING_ANIM_MS = 1250
const ACCENT = '#6eb0d4'

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  )

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduce
}

type Props = {
  value: number
  active: boolean
}

export function ScoreDonutRing({ value, active }: Props) {
  const reduceMotion = usePrefersReducedMotion()
  const [displayed, setDisplayed] = useState(() => (reduceMotion ? value : 0))
  const [runAnim, setRunAnim] = useState(false)

  useEffect(() => {
    if (!active) {
      setRunAnim(false)
      setDisplayed(reduceMotion ? value : 0)
      return
    }
    if (reduceMotion) {
      setDisplayed(value)
      setRunAnim(true)
      return
    }

    setDisplayed(0)
    setRunAnim(false)
    const startTimer = window.setTimeout(() => setRunAnim(true), 60)

    let raf = 0
    const countTimer = window.setTimeout(() => {
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / RING_ANIM_MS)
        const eased = 1 - (1 - t) ** 3
        setDisplayed(Math.round(value * eased))
        if (t < 1) raf = requestAnimationFrame(tick)
        else setDisplayed(value)
      }
      raf = requestAnimationFrame(tick)
    }, 60)

    return () => {
      clearTimeout(startTimer)
      clearTimeout(countTimer)
      cancelAnimationFrame(raf)
    }
  }, [active, reduceMotion, value])

  if (!runAnim && !reduceMotion) {
    return <div className="score-donut score-donut--placeholder" aria-hidden />
  }

  return (
    <DonutChart
      key={`${value}-${runAnim}`}
      className="score-donut"
      data={[{ value, color: ACCENT, label: 'Score' }]}
      totalValue={100}
      size={62}
      strokeWidth={4}
      animationDuration={1.25}
      animationDelayPerSegment={0}
      highlightOnHover={false}
      animate={!reduceMotion}
      centerContent={
        <>
          <b className="score-donut-value">{displayed}</b>
          <small className="score-donut-label">Score</small>
        </>
      }
    />
  )
}
