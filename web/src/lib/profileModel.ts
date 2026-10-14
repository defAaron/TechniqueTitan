import type { User } from '@supabase/supabase-js'

export type ProfileRecord = {
  /** Null until the user sets one. */
  displayName: string | null
  /**
   * Null uses the auth-provider photo.
   * Empty string means the user removed their photo.
   */
  avatarUrl: string | null
}

export const EMPTY_PROFILE: ProfileRecord = { displayName: null, avatarUrl: null }

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  const compact = name.replace(/\s+/g, '')
  return (compact.slice(0, 2) || '•').toUpperCase()
}

export function providerAvatar(user: User | null): string | null {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  const url = meta.avatar_url ?? meta.picture
  return typeof url === 'string' && url.length > 0 ? url : null
}

export function providerName(user: User | null): string | null {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  const name = meta.full_name ?? meta.name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

export function emailLabel(email: string | undefined): string {
  if (!email) return 'Account'
  const local = email.split('@')[0]
  return local || email
}

export function resolveDisplayName(user: User | null, record: ProfileRecord): string {
  const custom = record.displayName?.trim()
  if (custom) return custom
  return providerName(user) || emailLabel(user?.email)
}

/** First word of a display name (e.g. "Aaron Dutta" → "Aaron"). */
export function firstName(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return displayName
  const word = trimmed.split(/\s+/)[0]
  return word || trimmed
}

export function resolveAvatarSrc(user: User | null, record: ProfileRecord): string | null {
  if (record.avatarUrl === '') return null
  if (record.avatarUrl) return record.avatarUrl
  return providerAvatar(user)
}
