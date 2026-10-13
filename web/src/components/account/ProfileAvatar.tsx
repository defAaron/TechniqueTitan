import { useEffect, useState } from 'react'
import { profileInitials } from '../../lib/profileModel'

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-24 w-24 text-2xl',
} as const

export function ProfileAvatar({
  src,
  name,
  size = 'md',
}: {
  src: string | null
  name: string
  size?: keyof typeof SIZES
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [src])
  const showImage = Boolean(src) && !failed

  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/30',
        SIZES[size],
      ].join(' ')}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-body font-medium uppercase tracking-normal text-white/80">
          {profileInitials(name)}
        </span>
      )}
    </span>
  )
}
