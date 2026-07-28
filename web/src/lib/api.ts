/** API client + shared types for Technique Titan. */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const CRITERION_LABELS: Record<string, string> = {
  wrist_height: 'Wrist height',
  finger_curvature: 'Finger curvature',
  thumb_position: 'Thumb position',
  wrist_lateral: 'Wrist lateral deviation',
  hand_arch: 'Overall hand arch',
}

export type Severity = 'good' | 'warning' | 'critical' | 'unknown'

export interface CoachingTip {
  criterion: string
  severity: string
  direction: string
  problem: string
  fix: string
  priority: number
}

export interface Coaching {
  tips: CoachingTip[]
  primary: CoachingTip | null
  encouragement: string | null
}

export interface HandResult {
  label: string
  handedness: string
  confidence: number
  scores: Record<string, number | null>
  severities: Record<string, Severity | string>
  composite_score: number | null
  composite_severity: Severity | string
  criterion_metrics: Record<string, number | null>
  coaching: Coaching
  landmarks: number[][]
}

export interface AnalyzeResponse {
  hands: HandResult[]
  overlay_png_base64: string | null
  message: string | null
}

export interface VideoFrameScore {
  frame_index: number
  hands: HandResult[]
}

export interface VideoAnalyzeResponse {
  frames: VideoFrameScore[]
  timeline: Record<string, Array<number | null>>
  message: string | null
}

export interface LandmarkHand {
  landmarks: number[][]
  world_landmarks?: number[][] | null
  handedness: 'Left' | 'Right'
  confidence: number
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string') return body.detail
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    }
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`
}

export async function analyzeImage(
  file: File,
  includeOverlay = true,
): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('include_overlay', String(includeOverlay))
  const res = await fetch(`${API_BASE}/v1/analyze/image`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function analyzeFrame(
  blob: Blob,
  includeOverlay = true,
): Promise<AnalyzeResponse> {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  form.append('include_overlay', String(includeOverlay))
  const res = await fetch(`${API_BASE}/v1/analyze/frame`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function analyzeVideo(
  file: File,
  stride = 5,
  maxFrames = 120,
): Promise<VideoAnalyzeResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('stride', String(stride))
  form.append('max_frames', String(maxFrames))
  const res = await fetch(`${API_BASE}/v1/analyze/video`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function scoreLandmarks(
  hands: LandmarkHand[],
  opts?: { includeOverlay?: boolean; imageWidth?: number; imageHeight?: number },
): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/v1/score/landmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hands,
      include_overlay: opts?.includeOverlay ?? false,
      image_width: opts?.imageWidth ?? 640,
      image_height: opts?.imageHeight ?? 480,
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export function overlayDataUrl(base64: string | null | undefined): string | null {
  if (!base64) return null
  return `data:image/png;base64,${base64}`
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'good':
      return 'var(--color-good)'
    case 'warning':
      return 'var(--color-warn)'
    case 'critical':
      return 'var(--color-critical)'
    default:
      return 'var(--color-ink-muted)'
  }
}
