import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createScoreSmoother } from './scoreSmooth'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../tests/fixtures/temporal_cases.json',
)

type JsonScore = number | string | null

interface FixtureFrame {
  t_ms: number
  scores: Record<string, JsonScore>
  metrics: Record<string, JsonScore>
}

interface FixtureCase {
  id: string
  hand: string
  ideals: Record<string, [number, number]>
  frames: FixtureFrame[]
  expect: Record<string, { score: number; severity: string; direction: string }>[]
}

interface FixtureFile {
  alpha: number
  dwell_ms: number
  good_min: number
  warning_min: number
  score_abs_tol: number
  cases: FixtureCase[]
}

function parseNumeric(value: JsonScore): number | null {
  if (value === null) return null
  if (typeof value === 'number') return value
  if (value === 'NaN') return Number.NaN
  if (value === 'Infinity') return Number.POSITIVE_INFINITY
  if (value === '-Infinity') return Number.NEGATIVE_INFINITY
  return Number(value)
}

function parseRecord(raw: Record<string, JsonScore>): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const [key, value] of Object.entries(raw)) {
    out[key] = parseNumeric(value)
  }
  return out
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureFile

describe('createScoreSmoother oracle', () => {
  for (const testCase of fixture.cases) {
    it(testCase.id, () => {
      const smoother = createScoreSmoother({
        alpha: fixture.alpha,
        dwellMs: fixture.dwell_ms,
        goodMin: fixture.good_min,
        warningMin: fixture.warning_min,
      })

      testCase.frames.forEach((frame, index) => {
        const result = smoother.update({
          hand: testCase.hand,
          tMs: frame.t_ms,
          scores: parseRecord(frame.scores),
          metrics: parseRecord(frame.metrics),
          ideals: testCase.ideals,
        })

        const expected = testCase.expect[index]
        for (const [criterion, exp] of Object.entries(expected)) {
          const got = result.criteria[criterion]
          expect(got, `${testCase.id} frame ${index} ${criterion}`).toBeDefined()
          expect(
            got!.score,
            `${testCase.id} frame ${index} ${criterion} score`,
          ).toBeCloseTo(exp.score, 6)
          expect(got!.severity, `${testCase.id} frame ${index} ${criterion} severity`).toBe(
            exp.severity,
          )
          expect(got!.direction, `${testCase.id} frame ${index} ${criterion} direction`).toBe(
            exp.direction,
          )
        }

        const expectedKeys = new Set(Object.keys(expected))
        for (const key of Object.keys(result.criteria)) {
          expect(expectedKeys.has(key), `${testCase.id} frame ${index} extra ${key}`).toBe(true)
        }
      })
    })
  }
})
