import { describe, expect, it } from 'vitest'
import { safeNextPath } from './auth'

describe('safeNextPath', () => {
  it('allows same-app paths and simple queries', () => {
    const allowed = [
      '/progress',
      '/photo',
      '/live',
      '/video',
      '/settings',
      '/profile',
      '/admin',
      '/',
      '/photo?hand=left',
      '/progress?x=1&y=2',
      '/about#start',
    ]
    for (const path of allowed) {
      expect(safeNextPath(path)).toBe(path)
    }
  })

  it('falls back when next is missing', () => {
    expect(safeNextPath(null)).toBe('/progress')
    expect(safeNextPath('')).toBe('/progress')
  })

  it('rejects protocol-relative, absolute, and backslash hosts', () => {
    const rejected = [
      '//evil.com',
      '///evil.com',
      '\\\\evil.com',
      '/\\evil.com',
      '/\\\\evil.com',
      'https://evil.com',
      'http://evil.com',
      '/https://evil.com',
      'javascript:alert(1)',
      '/javascript:alert(1)',
      ' /progress',
      '/progress ',
      '/\t/evil.com',
      '/\n/evil.com',
      '/\r/evil.com',
      '/%2F%2Fevil.com',
      '/%5Cevil.com',
      '/%5C%5Cevil.com',
      '/%252F%252Fevil.com',
      '/photo?redir=https://evil.com',
      '/photo?x=%5Cevil',
      '/\uFF0Fevil.com',
      '/\uFF3Cevil.com',
    ]
    for (const path of rejected) {
      expect(safeNextPath(path)).toBe('/progress')
    }
  })
})
