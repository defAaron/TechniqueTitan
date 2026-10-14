import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn'

export interface DonutChartSegment {
  value: number
  color: string
  label: string
}

export interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: DonutChartSegment[]
  totalValue?: number
  size?: number
  strokeWidth?: number
  animationDuration?: number
  animationDelayPerSegment?: number
  highlightOnHover?: boolean
  /** When false, segments render at full length with no draw animation. */
  animate?: boolean
  centerContent?: React.ReactNode
  onSegmentHover?: (segment: DonutChartSegment | null) => void
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(
  (
    {
      data,
      totalValue: propTotalValue,
      size = 200,
      strokeWidth = 20,
      animationDuration = 1,
      animationDelayPerSegment = 0.05,
      highlightOnHover = true,
      animate = true,
      centerContent,
      onSegmentHover,
      className,
      ...props
    },
    ref,
  ) => {
    const [hoveredSegment, setHoveredSegment] = React.useState<DonutChartSegment | null>(null)

    const internalTotalValue = React.useMemo(
      () => propTotalValue ?? data.reduce((sum, segment) => sum + segment.value, 0),
      [data, propTotalValue],
    )

    const radius = size / 2 - strokeWidth / 2
    const circumference = 2 * Math.PI * radius
    let cumulativePercentage = 0

    React.useEffect(() => {
      onSegmentHover?.(hoveredSegment)
    }, [hoveredSegment, onSegmentHover])

    const handleMouseLeave = () => {
      setHoveredSegment(null)
    }

    return (
      <div
        ref={ref}
        className={cn('relative flex items-center justify-center', className)}
        style={{ width: size, height: size }}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 overflow-visible"
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#232323"
            strokeWidth={strokeWidth}
          />

          <AnimatePresence>
            {data.map((segment, index) => {
              if (segment.value === 0) return null

              const percentage =
                internalTotalValue === 0 ? 0 : (segment.value / internalTotalValue) * 100

              const arcLength = (percentage / 100) * circumference
              const strokeDasharray = `${arcLength} ${circumference}`
              const segmentOffset = (cumulativePercentage / 100) * circumference

              const isActive = hoveredSegment?.label === segment.label

              cumulativePercentage += percentage

              const targetOffset = -segmentOffset
              const hiddenOffset = circumference

              return (
                <motion.circle
                  key={segment.label || index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={animate ? hiddenOffset : targetOffset}
                  strokeLinecap="round"
                  initial={animate ? { opacity: 0, strokeDashoffset: hiddenOffset } : false}
                  animate={{
                    opacity: 1,
                    strokeDashoffset: targetOffset,
                  }}
                  transition={
                    animate
                      ? {
                          opacity: { duration: 0.3, delay: index * animationDelayPerSegment },
                          strokeDashoffset: {
                            duration: animationDuration,
                            delay: index * animationDelayPerSegment,
                            ease: 'easeOut',
                          },
                        }
                      : { duration: 0 }
                  }
                  className={cn(
                    'origin-center transition-transform duration-200',
                    highlightOnHover && 'cursor-pointer',
                  )}
                  style={{
                    filter: isActive
                      ? `drop-shadow(0px 0px 6px ${segment.color}) brightness(1.1)`
                      : 'none',
                    transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  }}
                  onMouseEnter={() => setHoveredSegment(segment)}
                />
              )
            })}
          </AnimatePresence>
        </svg>

        {centerContent ? (
          <div
            className="pointer-events-none absolute flex flex-col items-center justify-center"
            style={{
              width: size - strokeWidth * 2.5,
              height: size - strokeWidth * 2.5,
            }}
          >
            {centerContent}
          </div>
        ) : null}
      </div>
    )
  },
)

DonutChart.displayName = 'DonutChart'

export { DonutChart }
