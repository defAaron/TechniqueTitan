import { describe, expect, it } from 'vitest'
import type { Coaching } from './api'
import {
  applyCoachPlanToCoaching,
  buildHandCoachSignature,
  mergeCoachPlanFetch,
  withPrimaryWording,
  type CoachPlanResponse,
  type SmoothedCriterionSnapshot,
} from './coachPlan'

const BASE_CRITERIA: Record<string, SmoothedCriterionSnapshot> = {
  wrist_height: { severity: 'warning', direction: 'too_high' },
  finger_curvature: { severity: 'good', direction: 'inside' },
  thumb_position: { severity: 'good', direction: 'generic' },
  wrist_lateral: { severity: 'good', direction: 'generic' },
  hand_arch: { severity: 'warning', direction: 'too_low' },
}

const PREVIOUS_COACHING: Coaching = {
  tips: [
    {
      criterion: 'wrist_height',
      severity: 'warning',
      direction: 'too_high',
      problem: 'Old problem',
      fix: 'Old fix',
      priority: 0,
    },
  ],
  primary: {
    criterion: 'wrist_height',
    severity: 'warning',
    direction: 'too_high',
    problem: 'Old problem',
    fix: 'Old fix',
    priority: 0,
  },
  encouragement: null,
}

describe('buildHandCoachSignature', () => {
  it('changes when a smoothed severity changes', () => {
    const before = buildHandCoachSignature('Left', BASE_CRITERIA)
    const after = buildHandCoachSignature('Left', {
      ...BASE_CRITERIA,
      wrist_height: { severity: 'critical', direction: 'too_high' },
    })
    expect(after).not.toBe(before)
  })

  it('stays the same when only numeric scores change', () => {
    const a = buildHandCoachSignature('Right', BASE_CRITERIA)
    const b = buildHandCoachSignature('Right', { ...BASE_CRITERIA })
    expect(a).toBe(b)
  })
})

describe('applyCoachPlanToCoaching', () => {
  it('replaces problem and fix when plan_key changes', () => {
    const response: CoachPlanResponse = {
      plan: {
        hand: 'right',
        criterion: 'hand_arch',
        severity: 'warning',
        direction: 'too_low',
        renderer: 'template',
      },
      problem: 'Arch is flat',
      fix: 'Curve your hand more',
      encouragement: null,
      plan_key: 'v1|right|hand_arch|warning|too_low|live||',
      lock: null,
    }
    const { coaching } = applyCoachPlanToCoaching(PREVIOUS_COACHING, response, null)
    expect(coaching.primary?.problem).toBe('Arch is flat')
    expect(coaching.primary?.fix).toBe('Curve your hand more')
    expect(coaching.tips).toHaveLength(1)
    expect(coaching.tips[0]?.problem).toBe('Arch is flat')
  })
})

describe('withPrimaryWording', () => {
  it('replaces only the primary sentences and keeps criterion and severity', () => {
    const out = withPrimaryWording(PREVIOUS_COACHING, { problem: 'New problem', fix: 'New fix' })
    expect(out.primary).toMatchObject({
      criterion: 'wrist_height',
      severity: 'warning',
      problem: 'New problem',
      fix: 'New fix',
    })
    expect(out.tips[0]?.problem).toBe('New problem')
    expect(PREVIOUS_COACHING.primary?.problem).toBe('Old problem')
  })

  it('leaves encouragement-only coaching alone', () => {
    const encouragement: Coaching = { tips: [], primary: null, encouragement: 'Nice' }
    expect(withPrimaryWording(encouragement, { problem: 'x', fix: 'y' })).toBe(encouragement)
  })
})

describe('mergeCoachPlanFetch', () => {
  it('leaves previous problem and fix on a failed fetch', () => {
    const merged = mergeCoachPlanFetch(PREVIOUS_COACHING, null, { ok: false })
    expect(merged.coaching.primary?.problem).toBe('Old problem')
    expect(merged.coaching.primary?.fix).toBe('Old fix')
    expect(merged.appliedPlanKey).toBeNull()
  })
})
