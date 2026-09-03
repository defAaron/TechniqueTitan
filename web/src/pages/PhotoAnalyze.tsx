import { useState } from 'react'
import { CoachingTips, OverlayImage, ScorePanel } from '../components/analyze'
import { PageHeader } from '../components/layout'
import {
  analyzeImage,
  formatApiError,
  overlayDataUrl,
  type AnalyzeResponse,
} from '../lib/api'

const CAPTURE =
  'Side or ¾ view, good lighting, hand fully in frame, roughly forearm height.'

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
      setError(formatApiError(err, 'Analysis failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Photo" title="Photo review">
        {CAPTURE}
      </PageHeader>

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
              .map((hand) => (
                <div key={hand.label} className="space-y-4">
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
