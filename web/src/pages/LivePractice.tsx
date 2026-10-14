import { useCallback, useEffect, useRef, useState } from 'react'
import { ScorePanel } from '../components/analyze'
import { AddToProgressButton } from '../components/progress'
import {
  analyzeFrame,
  formatApiError,
  reduceProgressSession,
  scoreLandmarks,
  type AnalyzeResponse,
  type Coaching,
  type HandResult,
  type ProgressTick,
  type SessionDraftOut,
} from '../lib/api'
import {
  detectHandsVideo,
  drawHandOverlays,
  severityHex,
} from '../lib/mediapipe'
import {
  buildCoachPlanRequestBody,
  buildHandCoachSignature,
  fetchCoachPlan,
  mergeCoachPlanFetch,
  normalizeApiHand,
  withPrimaryWording,
  type SmoothedCriterionSnapshot,
} from '../lib/coachPlan'
import { rewordTip } from '../lib/coachModel'
import { createScoreSmoother } from '../lib/scoreSmooth'
import { CoachWordingToggle } from '../components/coach'

const SCORING_IDEALS: Record<string, [number, number]> = {
  wrist_height: [-0.0711, 0.966],
  finger_curvature: [117.5, 161.9],
  thumb_position: [18.15, 47.41],
  wrist_lateral: [-10.0, 10.0],
  hand_arch: [0.0324, 0.1616],
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 3,
  warning: 2,
  good: 1,
  unknown: 0,
}

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
  const scoreSmootherRef = useRef(createScoreSmoother())
  const prevHandSnapshotRef = useRef<
    Map<string, { severities: Record<string, string>; coaching: Coaching }>
  >(new Map())
  const smoothedCriteriaRef = useRef<Map<string, Record<string, SmoothedCriterionSnapshot>>>(
    new Map(),
  )
  const lastRequestedCoachSignatureRef = useRef<Map<string, string>>(new Map())
  const lastAppliedPlanKeyRef = useRef<Map<string, string | null>>(new Map())
  const coachRequestGenRef = useRef<Map<string, number>>(new Map())
  const sessionStartRef = useRef(0)
  const ticksRef = useRef<ProgressTick[]>([])
  const framesSeenRef = useRef(0)
  const [progressDraft, setProgressDraft] = useState<SessionDraftOut | null>(null)
  const [finalizing, setFinalizing] = useState(false)

  const finalizeSession = useCallback(async () => {
    if (!ticksRef.current.length) {
      setProgressDraft(null)
      return
    }
    setFinalizing(true)
    try {
      const draft = await reduceProgressSession({
        source: 'live',
        duration_s: Math.max(0, (Date.now() - sessionStartRef.current) / 1000),
        frames_seen: framesSeenRef.current,
        ticks: ticksRef.current,
      })
      setProgressDraft(draft)
    } catch {
      setProgressDraft(null)
    } finally {
      setFinalizing(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    lastResultsRef.current = null
    setRunning(false)
    setStatus('Camera idle')
    void finalizeSession()
  }, [finalizeSession])

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

  const smoothHands = useCallback((handsIn: HandResult[], tMs: number): HandResult[] => {
    return handsIn.map((hand) => {
      const smoothed = scoreSmootherRef.current.update({
        hand: hand.label,
        tMs,
        scores: hand.scores,
        metrics: hand.criterion_metrics,
        ideals: SCORING_IDEALS,
      })

      const scores = { ...hand.scores }
      const severities = { ...hand.severities }
      const criteriaSnap: Record<string, SmoothedCriterionSnapshot> = {}
      for (const [key, out] of Object.entries(smoothed.criteria)) {
        if (out.score != null) scores[key] = out.score
        severities[key] = out.severity
        criteriaSnap[key] = { severity: out.severity, direction: out.direction }
      }
      smoothedCriteriaRef.current.set(hand.label, criteriaSnap)

      let composite_severity = hand.composite_severity
      let worstRank = -1
      for (const sev of Object.values(severities)) {
        const rank = SEVERITY_RANK[String(sev)] ?? 0
        if (rank > worstRank) {
          worstRank = rank
          composite_severity = sev
        }
      }

      let coaching = hand.coaching
      const prev = prevHandSnapshotRef.current.get(hand.label)
      if (prev && severitiesMatch(severities, prev.severities)) {
        coaching = prev.coaching
      }

      return {
        ...hand,
        scores,
        severities,
        composite_severity,
        coaching,
      }
    })
  }, [])

  const applyCoachPlanToDisplay = useCallback((handLabel: string, coaching: Coaching) => {
    const display = lastResultsRef.current
    if (!display) return
    const hand = display.hands.find((h) => h.label === handLabel)
    if (!hand) return
    const severities = { ...hand.severities }
    prevHandSnapshotRef.current.set(handLabel, { severities, coaching })
    const updatedHands = display.hands.map((h) =>
      h.label === handLabel ? { ...h, coaching } : h,
    )
    const nextDisplay = { ...display, hands: updatedHands }
    lastResultsRef.current = nextDisplay
    setHands([...updatedHands].sort((a, b) => a.label.localeCompare(b.label)))
  }, [])

  const maybeRequestCoachPlan = useCallback(
    (hand: HandResult) => {
      const apiHand = normalizeApiHand(hand.label)
      if (!apiHand) return

      const criteria = smoothedCriteriaRef.current.get(hand.label)
      if (!criteria) return

      const signature = buildHandCoachSignature(hand.label, criteria)
      if (signature === lastRequestedCoachSignatureRef.current.get(hand.label)) return
      lastRequestedCoachSignatureRef.current.set(hand.label, signature)

      const gen = (coachRequestGenRef.current.get(hand.label) ?? 0) + 1
      coachRequestGenRef.current.set(hand.label, gen)

      const body = buildCoachPlanRequestBody({
        hand: apiHand,
        scores: hand.scores,
        severities: hand.severities as Record<string, string>,
        metrics: hand.criterion_metrics,
      })

      void fetchCoachPlan(body).then((outcome) => {
        if (coachRequestGenRef.current.get(hand.label) !== gen) return

        const current = lastResultsRef.current?.hands.find((h) => h.label === hand.label)
        const previousCoaching = current?.coaching ?? hand.coaching
        const lastKey = lastAppliedPlanKeyRef.current.get(hand.label) ?? null
        const merged = mergeCoachPlanFetch(previousCoaching, lastKey, outcome)
        if (merged.appliedPlanKey !== lastKey) {
          lastAppliedPlanKeyRef.current.set(hand.label, merged.appliedPlanKey)
        }
        if (merged.coaching === previousCoaching) return
        applyCoachPlanToDisplay(hand.label, merged.coaching)

        const response = outcome.ok ? outcome.response : null
        const plan = response?.plan
        const appliedKey = merged.appliedPlanKey
        if (!plan || !response?.problem || !response.fix || !appliedKey) return
        void rewordTip(plan, { problem: response.problem, fix: response.fix }).then((tip) => {
          if (tip.renderer !== 'model') return
          if (lastAppliedPlanKeyRef.current.get(hand.label) !== appliedKey) return
          const latest = lastResultsRef.current?.hands.find((h) => h.label === hand.label)
          if (latest?.coaching.primary?.criterion !== plan.criterion) return
          applyCoachPlanToDisplay(hand.label, withPrimaryWording(latest.coaching, tip))
        })
      })
    },
    [applyCoachPlanToDisplay],
  )

  const applyResults = useCallback(
    (res: AnalyzeResponse) => {
      const tMs = sessionStartRef.current
        ? Math.max(0, Date.now() - sessionStartRef.current)
        : 0
      const smoothedHands = smoothHands(res.hands, tMs)
      for (const hand of smoothedHands) {
        prevHandSnapshotRef.current.set(hand.label, {
          severities: { ...hand.severities },
          coaching: hand.coaching,
        })
      }

      const display: AnalyzeResponse = { ...res, hands: smoothedHands }
      lastResultsRef.current = display
      setHands([...smoothedHands].sort((a, b) => a.label.localeCompare(b.label)))
      paintFrame(display)
      if (display.message && !display.hands.length) setStatus(display.message)
      else setStatus(display.hands.length ? `${display.hands.length} hand(s)` : 'No hand')
      for (const hand of display.hands) {
        maybeRequestCoachPlan(hand)
      }
      if (display.hands.length && sessionStartRef.current) {
        framesSeenRef.current += 1
        const rawByLabel = new Map(res.hands.map((hand) => [hand.label, hand]))
        for (const hand of display.hands) {
          const raw = rawByLabel.get(hand.label) ?? hand
          ticksRef.current.push({
            t_ms: tMs,
            hand: raw.label,
            confidence: raw.confidence,
            composite_score: raw.composite_score,
            scores: raw.scores,
            severities: raw.severities,
            coaching: hand.coaching,
          })
        }
      }
    },
    [maybeRequestCoachPlan, paintFrame, smoothHands],
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
    setProgressDraft(null)
    ticksRef.current = []
    framesSeenRef.current = 0
    sessionStartRef.current = Date.now()
    scoreSmootherRef.current = createScoreSmoother()
    prevHandSnapshotRef.current = new Map()
    smoothedCriteriaRef.current = new Map()
    lastRequestedCoachSignatureRef.current = new Map()
    lastAppliedPlanKeyRef.current = new Map()
    coachRequestGenRef.current = new Map()
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
        <CoachWordingToggle className="sm:ml-auto" />
      </div>

      {!running && (progressDraft || finalizing) && (
        <div className="space-y-2">
          {finalizing && (
            <p className="font-body text-sm text-white/50">Building session summary…</p>
          )}
          <AddToProgressButton draft={progressDraft} />
        </div>
      )}

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

function severitiesMatch(
  a: Record<string, string | unknown>,
  b: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (String(a[key] ?? '') !== String(b[key] ?? '')) return false
  }
  return true
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
