import { useCallback, useEffect, useRef, useState } from 'react'
import { CoachingTips } from '../components/CoachingTips'
import { ScorePanel } from '../components/ScorePanel'
import {
  analyzeFrame,
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
    const interval = mode === 'landmarks' ? 250 : 400
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
              applyResults(res)
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Live analysis failed')
      } finally {
        inFlightRef.current = false
      }
    }

    rafRef.current = requestAnimationFrame(() => void tick())
  }, [applyResults, mode, paintFrame])

  async function startCamera() {
    setError(null)
    setHands([])
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Live practice
        </h1>
        <p className="mt-1 text-sm text-muted">
          Browser camera with real-time overlays. Preferred path sends landmarks only
          (MediaPipe in-browser); frame upload posts JPEGs to the API.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-line bg-surface p-1 text-sm">
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
                'rounded-full px-3 py-1.5 font-medium transition-all duration-200',
                mode === value
                  ? 'bg-primary text-foreground shadow-[0_0_18px_rgba(74,92,255,0.45)]'
                  : 'text-muted hover:text-foreground',
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
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-primary-bright hover:glow-blue"
          >
            Start camera
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="rounded-full border border-critical/50 bg-critical/10 px-5 py-2 text-sm font-semibold text-critical transition-colors hover:bg-critical/20"
          >
            Stop
          </button>
        )}
        <span className="text-xs text-muted">{status}</span>
      </div>

      {error && (
        <p className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative min-h-72 overflow-hidden rounded-2xl border border-line bg-background">
          <video ref={videoRef} playsInline muted className="hidden" />
          <canvas ref={canvasRef} className="block w-full" />
          {!running && (
            <div className="tech-grid absolute inset-0 flex items-center justify-center text-sm text-muted">
              Camera preview will appear here
            </div>
          )}
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {hands.length === 0 && running && (
            <p className="text-sm text-muted">Waiting for a visible hand…</p>
          )}
          {hands.map((hand) => (
            <div key={hand.label} className="space-y-3">
              <ScorePanel hand={hand} compact />
              <CoachingTips hand={hand} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
