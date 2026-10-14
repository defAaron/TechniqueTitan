export interface ScoreSmootherOptions {
  alpha?: number
  dwellMs?: number
  goodMin?: number
  warningMin?: number
}

export interface SmootherUpdateInput {
  hand: string
  tMs: number
  scores: Record<string, number | null>
  metrics: Record<string, number | null>
  ideals: Record<string, [number, number]>
}

export interface CriterionOutput {
  score: number | null
  severity: string
  direction: string
}

export interface SmootherUpdateResult {
  hand: string
  criteria: Record<string, CriterionOutput>
}

interface CriterionState {
  ema: number | null
  publishedSeverity: string | null
  pendingSeverity: string | null
  pendingSeveritySince: number
  publishedDirection: string | null
  pendingDirection: string | null
  pendingDirectionSince: number
}

export function createScoreSmoother(options: ScoreSmootherOptions = {}) {
  const alpha = options.alpha ?? 0.35
  const dwellMs = options.dwellMs ?? 1200
  const goodMin = options.goodMin ?? 80
  const warningMin = options.warningMin ?? 50
  const states = new Map<string, CriterionState>()

  function stateKey(hand: string, criterion: string) {
    return `${hand}:${criterion}`
  }

  function getState(hand: string, criterion: string): CriterionState {
    const key = stateKey(hand, criterion)
    let st = states.get(key)
    if (!st) {
      st = {
        ema: null,
        publishedSeverity: null,
        pendingSeverity: null,
        pendingSeveritySince: 0,
        publishedDirection: null,
        pendingDirection: null,
        pendingDirectionSince: 0,
      }
      states.set(key, st)
    }
    return st
  }

  function isFiniteScore(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value)
  }

  function clampScore(value: number): number {
    if (value < 0) return 0
    if (value > 100) return 100
    return value
  }

  function severityFromScore(score: number): string {
    if (score >= goodMin) return 'good'
    if (score >= warningMin) return 'warning'
    return 'critical'
  }

  type RawDirection = 'too_low' | 'too_high' | 'inside' | 'generic'

  function rawDirection(
    metric: number | null | undefined,
    ideal: [number, number] | undefined,
  ): RawDirection {
    if (!ideal || metric == null || !Number.isFinite(metric)) return 'generic'
    const [lo, hi] = ideal
    if (metric < lo) return 'too_low'
    if (metric > hi) return 'too_high'
    return 'inside'
  }

  function applySeverityDwell(st: CriterionState, band: string, tMs: number) {
    if (st.publishedSeverity == null) {
      st.publishedSeverity = band
      st.pendingSeverity = null
      return
    }
    if (band === st.publishedSeverity) {
      st.pendingSeverity = null
      return
    }
    if (st.pendingSeverity !== band) {
      st.pendingSeverity = band
      st.pendingSeveritySince = tMs
      return
    }
    if (tMs - st.pendingSeveritySince >= dwellMs) {
      st.publishedSeverity = band
      st.pendingSeverity = null
    }
  }

  function applyDirectionDwell(st: CriterionState, raw: RawDirection, tMs: number): string {
    if (raw === 'generic') {
      st.pendingDirection = null
      return 'generic'
    }
    if (raw === 'inside') {
      st.pendingDirection = null
      if (st.publishedDirection == null) {
        st.publishedDirection = 'generic'
        return 'generic'
      }
      return st.publishedDirection
    }

    const dir = raw
    if (st.publishedDirection == null) {
      st.publishedDirection = dir
      st.pendingDirection = null
      return dir
    }
    if (dir === st.publishedDirection) {
      st.pendingDirection = null
      return st.publishedDirection
    }
    if (st.pendingDirection !== dir) {
      st.pendingDirection = dir
      st.pendingDirectionSince = tMs
    } else if (tMs - st.pendingDirectionSince >= dwellMs) {
      st.publishedDirection = dir
      st.pendingDirection = null
    }
    return st.publishedDirection
  }

  function update(input: SmootherUpdateInput): SmootherUpdateResult {
    const criteria: Record<string, CriterionOutput> = {}
    const keys = new Set([
      ...Object.keys(input.scores),
      ...Object.keys(input.metrics),
    ])

    for (const criterion of keys) {
      const st = getState(input.hand, criterion)
      const rawScore = input.scores[criterion]
      const ideal = input.ideals[criterion]

      if (isFiniteScore(rawScore)) {
        const clamped = clampScore(rawScore)
        if (st.ema == null) {
          st.ema = clamped
        } else {
          st.ema = alpha * clamped + (1 - alpha) * st.ema
        }
        const band = severityFromScore(st.ema)
        applySeverityDwell(st, band, input.tMs)
      }

      if (st.ema == null) continue

      const direction = applyDirectionDwell(
        st,
        rawDirection(input.metrics[criterion], ideal),
        input.tMs,
      )

      criteria[criterion] = {
        score: st.ema,
        severity: st.publishedSeverity ?? severityFromScore(st.ema),
        direction,
      }
    }

    return { hand: input.hand, criteria }
  }

  return { update }
}
