import { useRef, useState } from 'react'
import { CoachingTips, OverlayImage, ScorePanel } from '../components/analyze'
import { CoachWordingToggle } from '../components/coach'
import { PageHeader } from '../components/layout'
import { AddToProgressButton } from '../components/progress'
import {
  analyzeImage,
  formatApiError,
  overlayDataUrl,
  type AnalyzeCoachPlan,
  type AnalyzeResponse,
  type HandResult,
} from '../lib/api'
import { rewordTip } from '../lib/coachModel'

function pickLowerCompositeHand(hands: HandResult[]): HandResult | null {
  if (!hands.length) return null
  return [...hands].sort((a, b) => {
    const scoreA = a.composite_score ?? -1
    const scoreB = b.composite_score ?? -1
    return scoreA - scoreB
  })[0]
}

function handForCoachPlan(
  hands: HandResult[],
  coachPlan: AnalyzeCoachPlan | null | undefined,
): string | null {
  if (!coachPlan) return null
  if (coachPlan.plan?.hand) return coachPlan.plan.hand
  const target = pickLowerCompositeHand(hands)
  return target ? target.label.toLowerCase() : null
}

function applyCoachPlanToHand(
  hand: HandResult,
  coachPlan: AnalyzeCoachPlan | null | undefined,
  coachHand: string | null,
): HandResult {
  if (!coachPlan || !coachHand || hand.label.toLowerCase() !== coachHand) {
    return hand
  }
  if (coachPlan.plan && coachPlan.problem && coachPlan.fix) {
    return {
      ...hand,
      coaching: {
        encouragement: null,
        tips: [],
        primary: {
          criterion: coachPlan.plan.criterion,
          severity: coachPlan.plan.severity,
          direction: coachPlan.plan.direction,
          problem: coachPlan.problem,
          fix: coachPlan.fix,
          priority: 0,
        },
      },
    }
  }
  if (!coachPlan.plan && coachPlan.encouragement) {
    return {
      ...hand,
      coaching: {
        encouragement: coachPlan.encouragement,
        tips: [],
        primary: null,
      },
    }
  }
  return hand
}

export function PhotoAnalyze() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [wording, setWording] = useState<{ problem: string; fix: string } | null>(null)
  const requestRef = useRef(0)

  function requestWording(coachPlan: AnalyzeCoachPlan | null | undefined) {
    const request = ++requestRef.current
    setWording(null)
    if (!coachPlan?.plan || !coachPlan.problem || !coachPlan.fix) return
    void rewordTip(coachPlan.plan, { problem: coachPlan.problem, fix: coachPlan.fix }).then(
      (tip) => {
        if (request === requestRef.current && tip.renderer === 'model') setWording(tip)
      },
    )
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    requestRef.current += 1
    setWording(null)
    try {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('Image is too large (max 8 MB).')
      }
      const res = await analyzeImage(file)
      setResult(res)
      requestWording(res.coach_plan)
      if (res.message && !res.hands.length) setError(res.message)
    } catch (err) {
      setError(formatApiError(err, 'Analysis failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader title="Photo review" />

      <CoachWordingToggle />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-white/20 bg-zinc-950 px-6 py-16 text-center transition-colors duration-500 hover:border-white/50">
        <span className="font-cinematic text-xl text-white">
          Drop a JPEG or PNG, or click to browse
        </span>
        <span className="font-body text-sm uppercase tracking-[0.2em] text-white/40">
          Max 8 MB
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>

      {busy && (
        <p className="animate-pulse-soft font-body text-base text-white/60">
          Detecting landmarks and scoring…
        </p>
      )}
      {error && (
        <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
          {error}
        </p>
      )}

      {result?.progress_draft?.hands?.length ? (
        <AddToProgressButton draft={result.progress_draft} className="mb-2" />
      ) : null}

      {result && (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <OverlayImage
            src={overlayDataUrl(result.overlay_png_base64)}
            caption={
              result.hands.length
                ? `Detected ${result.hands.length} hand(s): ${result.hands
                    .map((h) => h.label)
                    .sort()
                    .join(', ')}`
                : 'Uploaded image'
            }
          />
          <div className="space-y-6">
            {[...result.hands]
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((hand) => {
                const coachPlan =
                  result.coach_plan && wording ? { ...result.coach_plan, ...wording } : result.coach_plan
                const coachHand = handForCoachPlan(result.hands, coachPlan)
                const displayHand = applyCoachPlanToHand(hand, coachPlan, coachHand)
                return (
                  <div key={hand.label} className="space-y-4">
                    <ScorePanel hand={displayHand} compact />
                    <CoachingTips hand={displayHand} />
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
