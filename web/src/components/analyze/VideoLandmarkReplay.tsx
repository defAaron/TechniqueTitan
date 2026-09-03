import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoFrameScore } from '../../lib/api'
import { drawHandOverlays, severityHex } from '../../lib/mediapipe'

interface Props {
  src: string
  frames: VideoFrameScore[]
  fps?: number | null
}

function resolveFps(apiFps: number | null | undefined): number {
  if (apiFps && Number.isFinite(apiFps) && apiFps > 1 && apiFps < 240) return apiFps
  return 30
}

function frameForTime(
  frames: VideoFrameScore[],
  timeSec: number,
  fps: number,
): VideoFrameScore | null {
  if (!frames.length) return null
  const idx = Math.max(0, Math.round(timeSec * fps))
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].frame_index <= idx) lo = mid
    else hi = mid - 1
  }
  return frames[lo]
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoLandmarkReplay({ src, frames, fps }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const paint = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    const frame = frameForTime(frames, video.currentTime, resolveFps(fps))
    if (!frame?.hands.length) return
    drawHandOverlays(
      ctx,
      frame.hands.map((hand) => ({
        landmarks: hand.landmarks,
        color: severityHex(hand.composite_severity),
        marker: hand.label.slice(0, 1).toUpperCase(),
      })),
      w,
      h,
    )
  }, [frames, fps])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const stopLoop = () => cancelAnimationFrame(rafRef.current)
    const loop = () => {
      paint()
      setCurrentTime(video.currentTime)
      if (!video.paused && !video.ended) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    const onPlay = () => {
      setPlaying(true)
      stopLoop()
      rafRef.current = requestAnimationFrame(loop)
    }
    const onPause = () => {
      setPlaying(false)
      stopLoop()
      paint()
      setCurrentTime(video.currentTime)
    }
    const onEnded = () => {
      setPlaying(false)
      stopLoop()
      paint()
      setCurrentTime(video.currentTime)
    }
    const onSeeked = () => {
      paint()
      setCurrentTime(video.currentTime)
    }
    const onLoaded = () => {
      setDuration(video.duration || 0)
      paint()
      void video.play().catch(() => {
        /* autoplay can be blocked; controls still work */
      })
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadeddata', onLoaded)
    if (video.readyState >= 2) onLoaded()

    return () => {
      stopLoop()
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('loadeddata', onLoaded)
    }
  }, [paint, src])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = muted
  }, [muted])

  async function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.ended) video.currentTime = 0
    if (video.paused) await video.play()
    else video.pause()
  }

  function seek(value: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
    setCurrentTime(value)
    paint()
  }

  return (
    <section className="animate-fade-up border border-white/10 bg-zinc-950">
      <div className="flex items-baseline justify-between gap-4 border-b border-white/10 px-5 py-4">
        <h2 className="font-cinematic text-2xl font-normal text-white">Landmark replay</h2>
        <p className="font-body text-sm text-white/40">
          Uploaded clip with finger landmarks overlaid
        </p>
      </div>
      <div className="relative aspect-video overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={src}
          playsInline
          muted={muted}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="border border-white/30 px-5 py-2 font-body text-sm uppercase tracking-[0.3em] text-white/80 transition-all duration-500 hover:border-white hover:text-white"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.04}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          className="min-w-32 flex-1 accent-white"
          aria-label="Seek video"
        />
        <span className="font-body text-sm tabular-nums text-white/40">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="border border-white/15 px-4 py-2 font-body text-sm uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white"
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </section>
  )
}
