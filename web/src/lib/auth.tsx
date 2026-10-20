import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authCallbackUrl, isSupabaseConfigured, supabase } from './supabase'

type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  isAdmin: boolean
  isAdminLoading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  resendSignupEmail: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAdminLoading, setIsAdminLoading] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let cancelled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (cancelled) return
      setSession(next)
      // Wait for PKCE / URL session recovery before routing (see AuthCallbackPage).
      if (event === 'INITIAL_SESSION') {
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setIsAdmin(false)
      setIsAdminLoading(false)
      return
    }

    setIsAdminLoading(true)
    let cancelled = false
    void supabase.rpc('is_admin').then(({ data, error }) => {
      if (!cancelled) {
        setIsAdmin(!error && Boolean(data))
        setIsAdminLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [session])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Auth is not configured.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Auth is not configured.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authCallbackUrl() },
    })
    if (error) throw error
    return { needsConfirmation: !data.session }
  }, [])

  const resendSignupEmail = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Auth is not configured.')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authCallbackUrl() },
    })
    if (error) throw error
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Auth is not configured.')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl() },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      isAdmin,
      isAdminLoading,
      signInWithPassword,
      signUpWithPassword,
      resendSignupEmail,
      signInWithGoogle,
      signOut,
    }),
    [
      loading,
      session,
      isAdmin,
      isAdminLoading,
      signInWithPassword,
      signUpWithPassword,
      resendSignupEmail,
      signInWithGoogle,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const SAFE_NEXT_FALLBACK = '/progress'
const SAFE_NEXT_BASE = 'https://app.local'

/** Tab, CR, and LF are stripped by the URL parser and can turn a path into "//host". */
function hasUnsafePathChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return /\s/u.test(value)
}

function isSameAppPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false
  if (value.includes('\\') || value.includes('://')) return false
  if (/javascript:/i.test(value)) return false
  if (hasUnsafePathChars(value)) return false
  let url: URL
  try {
    url = new URL(value, SAFE_NEXT_BASE)
  } catch {
    return false
  }
  return url.origin === SAFE_NEXT_BASE && url.username === '' && url.password === ''
}

/** Repeated decoding so %252F%252F and %5C cannot hide an external URL. */
function decodedForms(value: string): string[] | null {
  const forms = [value]
  let current = value
  try {
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(current)
      if (next === current) break
      forms.push(next)
      current = next
    }
  } catch {
    return null
  }
  return forms
}

/**
 * Same-app relative path after login. Anything else, including protocol-relative
 * URLs, backslash hosts, and control-character bypasses, becomes /progress.
 */
export function safeNextPath(raw: string | null): string {
  if (!raw) return SAFE_NEXT_FALLBACK
  const candidates = [raw]
  const normalized = raw.normalize('NFKC')
  if (normalized !== raw) candidates.push(normalized)
  for (const candidate of candidates) {
    const forms = decodedForms(candidate)
    if (!forms || forms.some((form) => !isSameAppPath(form))) return SAFE_NEXT_FALLBACK
  }
  return raw
}

/** Confirmation / OAuth often lands on Site URL (`/`) instead of `/auth/callback`. */
export function isAuthReturnUrl(search: string, hash: string): boolean {
  const params = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return Boolean(
    params.get('code') ||
      params.get('error_code') ||
      params.get('error_description') ||
      params.get('error') ||
      hashParams.get('access_token') ||
      hashParams.get('error_code') ||
      hashParams.get('error_description') ||
      hashParams.get('error'),
  )
}
