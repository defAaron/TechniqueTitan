import { useState } from 'react'
import { CoachingTips } from '../components/CoachingTips'
import { OverlayImage } from '../components/OverlayImage'
import { ScorePanel } from '../components/ScorePanel'
import {
  analyzeImage,
  overlayDataUrl,
  type AnalyzeResponse,
} from '../lib/api'

const CAPTURE =
  'Capture tips: side or ¾ view, good lighting, hand fully in frame, roughly forearm height.'

export function PhotoAnalyze() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('Image is too large (max 8 MB).')
      }
      const res = await analyzeImage(file)
      setResult(res)
      if (res.message && !res.hands.length) setError(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Photo review</h1>
        <p className="mt-1 text-sm text-ink-muted">{CAPTURE}</p>
      </header>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-400/80 bg-white/50 px-6 py-10 text-center transition hover:border-forest hover:bg-white">
        <span className="font-medium">Drop a JPEG or PNG, or click to browse</span>
        <span className="text-xs text-ink-muted">Max 8 MB</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>

      {busy && (
        <p className="animate-pulse-soft text-sm font-medium text-forest">
          Detecting landmarks and scoring…
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
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
          <div className="space-y-4">
            {[...result.hands]
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((hand) => (
                <div key={hand.label} className="space-y-3">
                  <ScorePanel hand={hand} compact />
                  <CoachingTips hand={hand} />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
