import { useEffect, useMemo, useState } from 'react'
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
import { VideoLandmarkReplay } from '../components/analyze'
import { PageHeader } from '../components/layout'
import { analyzeVideo, formatApiError, type VideoAnalyzeResponse } from '../lib/api'

export function VideoAnalyze() {
  const [busy, setBusy] = useState(false)
  const [stride, setStride] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VideoAnalyzeResponse | null>(null)
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!clipFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(clipFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [clipFile])

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
    setClipFile(file)
    try {
      if (file.size > 40 * 1024 * 1024) {
        throw new Error('Video is too large (max 40 MB).')
      }
      const res = await analyzeVideo(file, stride)
      setResult(res)
      if (res.message && !res.frames.length) setError(res.message)
    } catch (err) {
      setError(formatApiError(err, 'Video analysis failed'))
    } finally {
      setBusy(false)
    }
  }

  const labels = result ? Object.keys(result.timeline).sort() : []

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Video" title="Video review">
        Upload a short clip; frames are sampled to build a posture timeline and a landmark
        replay. Prefer under ~30 seconds.
      </PageHeader>

      <div className="flex flex-col gap-6 border border-white/10 bg-zinc-950 p-6 sm:flex-row sm:items-end">
        <label className="flex-1 text-base">
          <span className="mb-2 block font-body text-sm uppercase tracking-[0.3em] text-white/50">
            Analyze every Nth frame
          </span>
          <input
            type="range"
            min={1}
            max={15}
            value={stride}
            onChange={(e) => setStride(Number(e.target.value))}
            className="w-full accent-white"
          />
          <span className="font-body text-sm text-white/40">Stride: {stride}</span>
        </label>
        <label className="cursor-pointer border border-white/30 px-8 py-3 text-center font-body text-sm uppercase tracking-[0.3em] text-white/80 transition-all duration-500 hover:border-white hover:text-white">
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
        <p className="animate-pulse-soft font-body text-base text-white/60">
          Analyzing frames… this can take a minute for longer clips.
        </p>
      )}
      {error && (
        <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-10">
          {chartData.length > 0 && (
            <section className="animate-fade-up border border-white/10 bg-zinc-950 p-5">
              <h2 className="mb-4 font-cinematic text-2xl font-normal text-white">
                Composite over time
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis
                      dataKey="i"
                      tick={{ fontSize: 12, fill: '#9a9a9a' }}
                      stroke="#2a2a2a"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#9a9a9a' }}
                      stroke="#2a2a2a"
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0c0c0c',
                        border: '1px solid #2a2a2a',
                        borderRadius: 0,
                        color: '#ffffff',
                      }}
                      labelStyle={{ color: '#9a9a9a' }}
                      cursor={{ stroke: '#ffffff', strokeOpacity: 0.35 }}
                    />
                    <Legend wrapperStyle={{ color: '#9a9a9a', fontSize: 13 }} />
                    {labels.map((label, idx) => (
                      <Line
                        key={label}
                        type="monotone"
                        dataKey={`${label} hand`}
                        stroke={idx === 0 ? '#ffffff' : '#9a9a9a'}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 font-body text-sm text-white/40">
                {result.frames.length} sampled frames analyzed
              </p>
            </section>
          )}
          {previewUrl && (
            <VideoLandmarkReplay src={previewUrl} frames={result.frames} fps={result.fps} />
          )}
        </div>
      )}
    </div>
  )
}
