import { useCallback, useEffect, useRef, useState } from 'react'
import { ScorePanel } from '../components/analyze'
import {
  analyzeFrame,
  formatApiError,
  scoreLandmarks,
  type AnalyzeResponse,
  type HandResult,
} from '../lib/api'
import {
  detectHandsVideo,
  drawHandOverlays,
  severityHex,
} from '../lib/mediapipe'

type Mode = 'landmarks' | 'frames'

export function LivePractice() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const lastSendRef = useRef(0)
  const inFlightRef = useRef(false)
  const backoffUntilRef = useRef(0)

  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<Mode>('landmarks')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Camera idle')
  const [hands, setHands] = useState<HandResult[]>([])

  const lastResultsRef = useRef<AnalyzeResponse | null>(null)

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    lastResultsRef.current = null
    setRunning(false)
    setStatus('Camera idle')
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const paintFrame = useCallback((results: AnalyzeResponse | null) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    if (results?.hands.length) {
      drawHandOverlays(
        ctx,
        results.hands.map((hand) => ({
          landmarks: hand.landmarks,
          color: severityHex(hand.composite_severity),
          marker: hand.label.slice(0, 1).toUpperCase(),
        })),
        w,
        h,
      )
    }
  }, [])

  const applyResults = useCallback(
    (res: AnalyzeResponse) => {
      lastResultsRef.current = res
      setHands([...res.hands].sort((a, b) => a.label.localeCompare(b.label)))
      paintFrame(res)
      if (res.message && !res.hands.length) setStatus(res.message)
      else setStatus(res.hands.length ? `${res.hands.length} hand(s)` : 'No hand')
    },
    [paintFrame],
  )

  const tick = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => void tick())
      return
    }

    paintFrame(lastResultsRef.current)

    const now = performance.now()
    if (now < backoffUntilRef.current) {
      rafRef.current = requestAnimationFrame(() => void tick())
      return
    }

    // Landmarks ~4 Hz; frames ~2 Hz — matches API per-path budgets.
    const interval = mode === 'landmarks' ? 250 : 500
    if (!inFlightRef.current && now - lastSendRef.current >= interval) {
      lastSendRef.current = now
      inFlightRef.current = true
      try {
        if (mode === 'landmarks') {
          const detected = await detectHandsVideo(video, now)
          if (detected.length) {
            const res = await scoreLandmarks(detected, {
              imageWidth: video.videoWidth,
              imageHeight: video.videoHeight,
            })
            setError(null)
            applyResults(res)
          } else {
            lastResultsRef.current = {
              hands: [],
              overlay_png_base64: null,
              message: null,
            }
            setHands([])
            setStatus('No hand')
            paintFrame(lastResultsRef.current)
          }
        } else {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0)
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/jpeg', 0.7),
            )
            if (blob) {
              const res = await analyzeFrame(blob, false)
              setError(null)
              applyResults(res)
            }
          }
        }
      } catch (err) {
        const message = formatApiError(err, 'Live analysis failed')
        if (message.toLowerCase().includes('rate limit')) {
          // Pause briefly instead of spamming the API / sticky red error.
          backoffUntilRef.current = performance.now() + 2000
          setStatus('Rate limited — pausing briefly…')
        } else {
          setError(message)
        }
      } finally {
        inFlightRef.current = false
      }
    }

    rafRef.current = requestAnimationFrame(() => void tick())
  }, [applyResults, mode, paintFrame])

  async function startCamera() {
    setError(null)
    setHands([])
    backoffUntilRef.current = 0
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setRunning(true)
      setStatus(
        mode === 'landmarks'
          ? 'Loading MediaPipe… first frame may take a moment'
          : 'Streaming frames to API…',
      )
      rafRef.current = requestAnimationFrame(() => void tick())
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open camera. Check browser permissions.',
      )
      stopCamera()
    }
  }

  const leftHand = hands.find((h) => h.label.toLowerCase() === 'left')
  const rightHand = hands.find((h) => h.label.toLowerCase() === 'right')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header>
          <p className="mb-1 font-body text-sm uppercase tracking-[0.4em] text-white/40">
            Live
          </p>
          <h1 className="font-cinematic text-3xl font-normal tracking-tight text-white sm:text-4xl">
            Live practice
          </h1>
        </header>
        <p className="max-w-md font-body text-sm font-light text-white/40">
          Browser camera with real-time overlays. Landmarks stay on-device; frame
          upload posts JPEGs to the API.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex border border-white/15 text-sm">
          {(
            [
              ['landmarks', 'Landmarks (fast)'],
              ['frames', 'Frame upload'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={running}
              onClick={() => setMode(value)}
              className={[
                'px-4 py-2.5 font-body uppercase tracking-[0.18em] transition-colors duration-300',
                mode === value
                  ? 'bg-white text-black'
                  : 'text-white/50 hover:text-white',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {!running ? (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="border border-white/30 px-8 py-2.5 font-body text-sm uppercase tracking-[0.3em] text-white/80 transition-all duration-500 hover:border-white hover:text-white"
          >
            Start camera
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="border border-critical/50 bg-critical/10 px-8 py-2.5 font-body text-sm uppercase tracking-[0.3em] text-critical transition-colors hover:bg-critical/20"
          >
            Stop
          </button>
        )}
        <span className="font-body text-sm text-white/40">{status}</span>
      </div>

      {error && (
        <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="relative aspect-video min-h-56 overflow-hidden border border-white/10 bg-black">
          <video ref={videoRef} playsInline muted className="hidden" />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />
          {!running && (
            <div className="absolute inset-0 flex items-center justify-center font-body text-base text-white/40">
              Camera preview will appear here
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HandSlot label="Left" hand={leftHand} running={running} />
          <HandSlot label="Right" hand={rightHand} running={running} />
        </div>
      </div>
    </div>
  )
}

function HandSlot({
  label,
  hand,
  running,
}: {
  label: string
  hand: HandResult | undefined
  running: boolean
}) {
  if (hand) return <ScorePanel hand={hand} dense />

  return (
    <div className="flex h-full min-h-48 items-center justify-center border border-white/10 bg-zinc-950 px-4 py-6 text-center">
      <p className="font-body text-sm text-white/40">
        {running ? `Waiting for ${label.toLowerCase()} hand…` : `${label} hand`}
      </p>
    </div>
  )
}
