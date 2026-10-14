import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { chooseTip, rewordTip } from './coachModel'
import {
  COACH_MODEL_PREF_KEY,
  COACH_SYSTEM_PROMPT,
  coachModelSource,
  modelMessages,
  parseModelTip,
  readCoachModelPref,
  toModelPlan,
  writeCoachModelPref,
} from './coachModelProtocol'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const firstAccepted = JSON.parse(
  readFileSync(join(repoRoot, 'data/coach/accepted.jsonl'), 'utf-8').split('\n')[0],
) as { messages: Array<{ role: string; content: string }> }

const plan = {
  hand: 'right',
  criterion: 'wrist_height',
  severity: 'warning',
  direction: 'too_high',
  score: 62,
  tip_kind: 'live',
  metric_value: 1.12,
  ideal: [-0.0711, 0.966],
  focus_criterion: 'wrist_height',
  history: [{ secret: true }],
  user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
}
const template = {
  problem: 'Your wrist is starting to drop below the knuckle line.',
  fix: 'Gently lift the wrist until it lines up with your knuckles.',
}

describe('model prompt', () => {
  it('uses the exact training system prompt', () => {
    expect(COACH_SYSTEM_PROMPT).toBe(firstAccepted.messages[0].content)
  })

  it('formats the user message like the training rows', () => {
    const seedPlan = JSON.parse(firstAccepted.messages[1].content)
    const modelPlan = toModelPlan(seedPlan)
    expect(modelPlan).not.toBeNull()
    expect(modelMessages(modelPlan!)[1].content).toBe(firstAccepted.messages[1].content)
  })

  it('sends only the five short plan fields', () => {
    const modelPlan = toModelPlan(plan)
    expect(modelPlan).toEqual({
      criterion: 'wrist_height',
      severity: 'warning',
      direction: 'too_high',
      score: 62,
      tip_kind: 'live',
    })
    const [system, user] = modelMessages(modelPlan!)
    expect(system.role).toBe('system')
    expect(user.content).not.toContain('history')
    expect(user.content).not.toContain('user_id')
  })

  it('refuses plans without a finite score or tip kind', () => {
    expect(toModelPlan({ ...plan, score: Number.NaN })).toBeNull()
    expect(toModelPlan({ ...plan, tip_kind: null })).toBeNull()
  })
})

describe('parseModelTip', () => {
  it.each([
    ['{"problem": "A.", "fix": "B."}', { problem: 'A.', fix: 'B.' }],
    ['Sure! {"problem": " A. ", "fix": "B."} done', { problem: 'A.', fix: 'B.' }],
    ['not json', null],
    ['{"problem": "A."}', null],
    ['{"problem": "", "fix": "B."}', null],
    ['{"problem": 1, "fix": "B."}', null],
    ['[1, 2]', null],
  ])('%s', (text, expected) => {
    expect(parseModelTip(text)).toEqual(expected)
  })
})

describe('chooseTip', () => {
  it('keeps a valid model sentence', () => {
    const model = { problem: 'Your wrist is dipping.', fix: 'Raise the wrist to the knuckles.' }
    expect(chooseTip(template, model, plan)).toEqual({ ...model, renderer: 'model' })
  })

  it.each([
    ['no model output', null],
    ['deny word', { problem: 'Your wrist may need a doctor.', fix: 'Lift the wrist.' }],
    ['wrong criterion words', { problem: 'Your thumb drifts.', fix: 'Relax the thumb.' }],
    ['invented number', { problem: 'Your wrist is 12 off.', fix: 'Lift the wrist.' }],
    ['markdown', { problem: 'Your **wrist** dips.', fix: 'Lift the wrist.' }],
  ])('falls back to the template on %s', (_name, model) => {
    expect(chooseTip(template, model, plan)).toEqual({ ...template, renderer: 'template' })
  })
})

describe('rewordTip', () => {
  it('returns the template when the model is off', async () => {
    await expect(rewordTip(plan, template)).resolves.toEqual({ ...template, renderer: 'template' })
  })
})

describe('toggle config', () => {
  it('hides the toggle unless both repo and revision are set', () => {
    expect(coachModelSource({})).toBeNull()
    expect(coachModelSource({ VITE_COACH_MODEL_REPO: 'me/technique-titan-coach-onnx' })).toBeNull()
    expect(coachModelSource({ VITE_COACH_MODEL_REPO: ' ', VITE_COACH_MODEL_REVISION: 'abc' })).toBeNull()
    expect(
      coachModelSource({
        VITE_COACH_MODEL_REPO: 'me/technique-titan-coach-onnx',
        VITE_COACH_MODEL_REVISION: 'abc123',
      }),
    ).toEqual({ repo: 'me/technique-titan-coach-onnx', revision: 'abc123' })
  })

  it('stores the preference as 0 or 1 under tt-coach-model', () => {
    const map = new Map<string, string>()
    const store = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }
    expect(readCoachModelPref(store)).toBe(false)
    writeCoachModelPref(store, true)
    expect(map.get(COACH_MODEL_PREF_KEY)).toBe('1')
    expect(readCoachModelPref(store)).toBe(true)
    writeCoachModelPref(store, false)
    expect(map.get(COACH_MODEL_PREF_KEY)).toBe('0')
    expect(readCoachModelPref(null)).toBe(false)
  })
})
