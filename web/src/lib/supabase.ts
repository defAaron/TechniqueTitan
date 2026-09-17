import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Vercel/JWT pastes often wrap, quote, or insert spaces — keys cannot contain whitespace. */
function readViteEnv(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '')
}

function isUsableAnonKey(key: string): boolean {
  if (key.startsWith('sb_publishable_') && key.length > 24) return true
  const parts = key.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

const url = readViteEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')
const anonKey = readViteEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

export type SupabaseConfigIssue = 'missing' | 'invalid_key' | null

export const supabaseConfigIssue: SupabaseConfigIssue = !url || !anonKey
  ? 'missing'
  : isUsableAnonKey(anonKey)
    ? null
    : 'invalid_key'

export const isSupabaseConfigured = supabaseConfigIssue === null

export function supabaseConfigHelp(): string {
  if (supabaseConfigIssue === 'invalid_key') {
    return 'This build has a truncated or malformed Supabase anon key. In Vercel, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the same project (full key, one line, no quotes), then redeploy.'
  }
  return 'Auth is not configured in this build. Copy web/.env.example to web/.env.local, set the Supabase URL and anon key, then restart Vite (or redeploy Vercel).'
}

/** Null when Vite env is missing/invalid so CI `npm run build` still succeeds. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

export function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}
