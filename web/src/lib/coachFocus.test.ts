import { describe, expect, it } from 'vitest'
import type { PracticeSessionListRow } from './progress'
import {
  buildCoachPlanHistoryFromSessions,
  COACH_FOCUS_EMPTY_MESSAGE,
  formatCoachFocusMessage,
  mapSessionToPlanHistoryEntry,
} from './coachFocus'

describe('formatCoachFocusMessage', () => {
  it('returns the empty-focus sentence when there is no lock', () => {
    expect(formatCoachFocusMessage(null)).toBe(COACH_FOCUS_EMPTY_MESSAGE)
    expect(formatCoachFocusMessage(null)).toBe('Practice a few times to get a weekly focus.')
  })

  it('includes the criterion label and formatted locked_until date', () => {
    const message = formatCoachFocusMessage(
      { criterion: 'wrist_height', locked_until: '2026-10-20' },
      'en-US',
    )
    expect(message).toContain('Wrist height')
    expect(message).toContain(
      new Date('2026-10-20T12:00:00').toLocaleDateString('en-US'),
    )
  })
})

describe('buildCoachPlanHistoryFromSessions', () => {
  it('drops primary_issue values that are not criterion names', () => {
    const session: PracticeSessionListRow = {
      id: 's1',
      source: 'live',
      started_at: '2026-10-13T15:00:00.000Z',
      duration_s: 60,
      frames_kept: 10,
      scoring_version: 'yaml',
      session_hands: [
        {
          hand: 'Right',
          frames_kept: 10,
          mean_composite: 55,
          p10_composite: 50,
          mean_scores: {},
          frac_warning: {},
          frac_critical: {},
          primary_issue: '../',
          tip_problem: null,
          tip_fix: null,
        },
        {
          hand: 'Left',
          frames_kept: 10,
          mean_composite: 60,
          p10_composite: 55,
          mean_scores: {},
          frac_warning: {},
          frac_critical: {},
          primary_issue: '<script>',
          tip_problem: null,
          tip_fix: null,
        },
      ],
    }
    const entry = mapSessionToPlanHistoryEntry(session)
    expect(entry).not.toBeNull()
    expect(entry!.hands.every((h) => h.primary_issue === null)).toBe(true)

    const history = buildCoachPlanHistoryFromSessions([session])
    expect(history).toHaveLength(1)
    expect(history[0].hands.every((h) => h.primary_issue === null)).toBe(true)
  })
})
