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
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
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

/** Internal path only — rejects protocol-relative and external URLs. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
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
