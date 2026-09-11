import { useEffect, useRef } from 'react'

export interface VideoSource {
  src: string
  type: string
}

export interface VideoPreviewProps {
  /** Single file used when `sources` is omitted. */
  src?: string
  /** Preferred when present. Order is browser pick order (WebM, then MP4). */
  sources?: readonly VideoSource[]
  className?: string
  width?: number
  height?: number
  'aria-label'?: string
  'aria-hidden'?: boolean
}

function mimeFromSrc(path: string): string {
  const ext = path.split('?')[0]?.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'webm':
      return 'video/webm'
    case 'ogg':
    case 'ogv':
      return 'video/ogg'
    case 'mov':
      return 'video/quicktime'
    default:
      return 'video/mp4'
  }
}

function resolveSources(src: string | undefined, sources: readonly VideoSource[] | undefined): VideoSource[] {
  if (sources && sources.length > 0) return [...sources]
  if (src) return [{ src, type: mimeFromSrc(src) }]
  return []
}

const PLAY_RETRY_MS = [0, 160, 320, 640, 1200, 2000] as const

function armSafariInline(video: HTMLVideoElement) {
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.autoplay = true
  video.loop = true
  video.controls = false
  video.removeAttribute('controls')
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.setAttribute('muted', '')
  video.setAttribute('autoplay', '')
  video.setAttribute('x-webkit-airplay', 'deny')
}

/**
 * Silent looping preview. Each instance owns its own ref so multiple
 * copies on one page cannot share play state. Never sets `controls`.
 */
export function VideoPreview({
  src,
  sources,
  className = 'h-full w-full object-cover',
  width,
  height,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const resolved = resolveSources(src, sources)
  const sourceKey = resolved.map((source) => `${source.type}:${source.src}`).join('|')

  useEffect(() => {
    const video = videoRef.current
    if (!video || resolved.length === 0) return

    armSafariInline(video)

    let cancelled = false
    let attempt = 0
    const timers: number[] = []

    const tryPlay = () => {
      if (cancelled) return
      armSafariInline(video)
      const playAttempt = video.play()
      if (playAttempt === undefined) return
      void playAttempt.catch(() => {
        if (cancelled || attempt >= PLAY_RETRY_MS.length - 1) return
        attempt += 1
        timers.push(window.setTimeout(tryPlay, PLAY_RETRY_MS[attempt]))
      })
    }

    const onReady = () => {
      attempt = 0
      tryPlay()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryPlay()
    }

    video.addEventListener('canplay', onReady)
    video.addEventListener('loadeddata', onReady)
    document.addEventListener('visibilitychange', onVisibility)
    tryPlay()

    return () => {
      cancelled = true
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('loadeddata', onReady)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const id of timers) window.clearTimeout(id)
    }
  }, [sourceKey, resolved.length])

  if (resolved.length === 0) return null

  return (
    <video
      ref={videoRef}
      className={`video-preview ${className}`.trim()}
      width={width}
      height={height}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      controlsList="nodownload nofullscreen noremoteplayback"
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
    >
      {resolved.map((source) => (
        <source key={source.src} src={source.src} type={source.type} />
      ))}
    </video>
  )
}
