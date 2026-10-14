import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COACH_DIRECTION_GUARDS, validateTip, type ValidatorPlan } from './coachValidate'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')

interface FixtureCase {
  name: string
  text: string
  plan: ValidatorPlan
  expect: 'pass' | 'fail'
  code: string | null
}

const cases = JSON.parse(
  readFileSync(join(repoRoot, 'tests/fixtures/coach_validator_cases.json'), 'utf-8'),
) as FixtureCase[]

function jsonl(path: string): Array<{ messages: Array<{ role: string; content: string }> }> {
  return readFileSync(join(repoRoot, path), 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

describe('validateTip fixture parity with Python', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const codes = validateTip(c.text, c.plan)
    if (c.expect === 'pass') expect(codes).toEqual([])
    else expect(codes).toContain(c.code)
  })
})

describe('validateTip on reviewed coach data', () => {
  it.each(['data/coach/accepted.jsonl', 'data/coach/probe.jsonl'])('%s passes', (path) => {
    const rows = jsonl(path)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const plan = JSON.parse(row.messages[1].content) as ValidatorPlan
      const tip = JSON.parse(row.messages[2].content) as { problem: string; fix: string }
      expect(validateTip(`${tip.problem} ${tip.fix}`, plan)).toEqual([])
    }
  })
})

describe('direction guards', () => {
  const plan: ValidatorPlan = {
    tip_kind: 'live',
    criterion: 'wrist_height',
    direction: 'too_high',
    score: 70,
    metric_value: null,
    ideal: [0, 1],
  }
  const text = 'Gently lift the wrist until it lines up with your knuckles.'

  it('rejects a listed phrase', () => {
    expect(validateTip(text, plan, { wrist_height: { too_high: ['lift the wrist'] } })).toEqual([
      'direction_guard',
    ])
  })

  it('mirrors the YAML, where every list is empty', () => {
    const yaml = readFileSync(join(repoRoot, 'config/coach_direction_guards.yaml'), 'utf-8')
    const lists = [...yaml.matchAll(/^\s+(too_low|too_high|generic):\s*(.*)$/gm)].map((m) => m[2])
    expect(lists.length).toBe(15)
    expect(lists.every((value) => value.trim() === '[]')).toBe(true)
    expect(COACH_DIRECTION_GUARDS).toEqual({})
  })
})
