import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { analyzeVideo, type VideoAnalyzeResponse } from '../lib/api'

export function VideoAnalyze() {
  const [busy, setBusy] = useState(false)
  const [stride, setStride] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VideoAnalyzeResponse | null>(null)

  const chartData = useMemo(() => {
    if (!result) return []
    const labels = Object.keys(result.timeline).sort()
    const maxLen = Math.max(0, ...labels.map((l) => result.timeline[l]?.length ?? 0))
    return Array.from({ length: maxLen }, (_, i) => {
      const row: Record<string, number | string | null> = { i }
      for (const label of labels) {
        row[`${label} hand`] = result.timeline[label][i] ?? null
      }
      return row
    })
  }, [result])

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (file.size > 40 * 1024 * 1024) {
        throw new Error('Video is too large (max 40 MB).')
      }
      const res = await analyzeVideo(file, stride)
      setResult(res)
      if (res.message && !res.frames.length) setError(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video analysis failed')
    } finally {
      setBusy(false)
    }
  }

  const labels = result ? Object.keys(result.timeline).sort() : []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Video review</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload a short clip; frames are sampled to build a posture timeline. Prefer under
          ~30 seconds.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-stone-300/70 bg-white/60 p-5 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium">Analyze every Nth frame</span>
          <input
            type="range"
            min={1}
            max={15}
            value={stride}
            onChange={(e) => setStride(Number(e.target.value))}
            className="w-full accent-forest"
          />
          <span className="text-xs text-ink-muted">Stride: {stride}</span>
        </label>
        <label className="cursor-pointer rounded-full bg-forest px-5 py-2.5 text-center text-sm font-semibold text-paper hover:bg-forest-bright">
          Choose video
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi,.m4v"
            className="hidden"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {busy && (
        <p className="animate-pulse-soft text-sm font-medium text-forest">
          Analyzing frames… this can take a minute for longer clips.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && chartData.length > 0 && (
        <section className="animate-fade-up rounded-2xl border border-stone-300/70 bg-white/70 p-4 shadow-sm">
          <h2 className="mb-3 font-display text-xl font-semibold">Composite over time</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
                <XAxis dataKey="i" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {labels.map((label, idx) => (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={`${label} hand`}
                    stroke={idx === 0 ? '#1f5c45' : '#b45309'}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {result.frames.length} sampled frames analyzed
          </p>
        </section>
      )}
    </div>
  )
}
