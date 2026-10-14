/** Port of `src/technique_titan/coach/validate.py` (spec §3.3). Same fixture as pytest. */

export interface ValidatorPlan {
  criterion?: string | null
  direction?: string | null
  tip_kind?: string | null
  score?: number | null
  metric_value?: number | null
  ideal?: number[] | null
}

export type DirectionGuards = Record<string, Record<string, string[]>>

export const LENGTH_CAPS: Record<string, number> = { live: 220, photo: 320, recap: 480 }

export const ALLOW_WORDS: Record<string, readonly string[]> = {
  wrist_height: ['wrist', 'knuckle'],
  finger_curvature: ['finger', 'curve', 'round'],
  thumb_position: ['thumb'],
  wrist_lateral: ['wrist', 'side'],
  hand_arch: ['arch', 'knuckle', 'palm'],
}

export const DENY_WORDS = [
  'diagnos',
  'injur',
  'doctor',
  'medical',
  'pain',
  'surgery',
  'arthritis',
] as const

/** Mirror of `config/coach_direction_guards.yaml` (every list is empty today). */
export const COACH_DIRECTION_GUARDS: DirectionGuards = {}

const MARKDOWN_CHARS = new Set(['#', '*', '`', '[', ']'])
const NUMBER_RE = /-?\d+(?:\.\d+)?/g
const SYMBOL_OTHER_RE = /\p{So}/u

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9'
}

function sentenceTerminatorIndices(chars: string[]): number[] {
  const indices: number[] = []
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === '!' || ch === '?') {
      indices.push(i)
    } else if (ch === '.') {
      if (i > 0 && i + 1 < chars.length && isDigit(chars[i - 1]) && isDigit(chars[i + 1])) continue
      indices.push(i)
    }
  }
  return indices
}

function countSentences(text: string): number {
  const chars = [...text.trim()]
  if (!chars.length) return 0
  const ends = sentenceTerminatorIndices(chars)
  if (!ends.length) return 1
  const tail = chars
    .slice(ends[ends.length - 1] + 1)
    .join('')
    .trim()
  return ends.length + (tail ? 1 : 0)
}

function hasMarkdown(text: string): boolean {
  for (const ch of text) if (MARKDOWN_CHARS.has(ch)) return true
  return text.split(/\r\n|\r|\n/).some((line) => /^\s*#+\s/.test(line))
}

function isEmojiChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  if (code >= 0x1f300 && code <= 0x1faff) return true
  if (code >= 0x2600 && code <= 0x27bf) return true
  return SYMBOL_OTHER_RE.test(ch)
}

function hasEmoji(text: string): boolean {
  for (const ch of text) if (isEmojiChar(ch)) return true
  return false
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function numberAllowed(value: number, plan: ValidatorPlan): boolean {
  const score = finiteNumber(plan.score)
  if (score !== null && Math.abs(value - score) <= 2) return true
  const metric = finiteNumber(plan.metric_value)
  if (metric !== null && Math.abs(value - metric) <= 0.05) return true
  for (const bound of plan.ideal ?? []) {
    const b = finiteNumber(bound)
    if (b !== null && Math.abs(value - b) <= 1e-4) return true
  }
  return false
}

function directionPhrases(plan: ValidatorPlan, guards: DirectionGuards): string[] {
  const { criterion, direction } = plan
  if (!criterion || !direction) return []
  const phrases = guards[criterion]?.[direction]
  if (!Array.isArray(phrases)) return []
  return phrases.filter(Boolean).map(String)
}

/** Rejection codes in the same order as Python; empty array means the tip passes. */
export function validateTip(
  text: string,
  plan: ValidatorPlan,
  guards: DirectionGuards = COACH_DIRECTION_GUARDS,
): string[] {
  const codes: string[] = []
  const stripped = text.trim()
  if (!stripped) return ['empty']

  if (countSentences(stripped) > 2) codes.push('sentences')
  if (hasMarkdown(stripped)) codes.push('markdown')
  if (hasEmoji(stripped)) codes.push('emoji')

  const cap = LENGTH_CAPS[plan.tip_kind ?? 'live'] ?? LENGTH_CAPS.live
  if ([...stripped].length > cap) codes.push('length')

  const lowered = stripped.toLowerCase()
  const allow = ALLOW_WORDS[plan.criterion ?? ''] ?? []
  if (allow.length && !allow.some((word) => lowered.includes(word))) codes.push('allow_word')

  if (DENY_WORDS.some((word) => lowered.includes(word))) codes.push('deny_word')

  for (const match of stripped.matchAll(NUMBER_RE)) {
    if (!numberAllowed(Number(match[0]), plan)) {
      codes.push('number')
      break
    }
  }

  for (const phrase of directionPhrases(plan, guards)) {
    if (lowered.includes(phrase.toLowerCase())) {
      codes.push('direction_guard')
      break
    }
  }

  return codes
}
