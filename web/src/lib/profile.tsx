import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './auth'
import {
  EMPTY_PROFILE,
  resolveAvatarSrc,
  resolveDisplayName,
  type ProfileRecord,
} from './profileModel'
import { supabase } from './supabase'

const AVATAR_PATH = 'avatar.jpg'

type SaveProfileInput = {
  displayName: string
  file?: Blob | null
  removePhoto?: boolean
}

type ProfileContextValue = {
  loaded: boolean
  record: ProfileRecord
  displayName: string
  avatarSrc: string | null
  refresh: () => Promise<void>
  save: (input: SaveProfileInput) => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [record, setRecord] = useState<ProfileRecord>(EMPTY_PROFILE)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setRecord(EMPTY_PROFILE)
      setLoaded(!user)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      setLoaded(true)
      return
    }
    setRecord({
      displayName: typeof data?.display_name === 'string' ? data.display_name : null,
      avatarUrl: typeof data?.avatar_url === 'string' ? data.avatar_url : null,
    })
    setLoaded(true)
  }, [user])

  useEffect(() => {
    setLoaded(false)
    setRecord(EMPTY_PROFILE)
    void refresh()
  }, [refresh])

  const save = useCallback(
    async ({ displayName, file, removePhoto }: SaveProfileInput) => {
      if (!supabase || !user) throw new Error('Sign in to update your profile.')
      const trimmed = displayName.trim().slice(0, 80)
      const storedName = trimmed.length > 0 ? trimmed : null
      let nextAvatar = record.avatarUrl

      if (file) {
        const path = `${user.id}/${AVATAR_PATH}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg',
          cacheControl: '3600',
        })
        if (uploadError) throw uploadError
        const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path)
        nextAvatar = `${publicUrl.publicUrl}?v=${Date.now()}`
      } else if (removePhoto) {
        const { error: removeError } = await supabase.storage
          .from('avatars')
          .remove([`${user.id}/${AVATAR_PATH}`])
        if (removeError) throw removeError
        nextAvatar = ''
      }

      const patch = { display_name: storedName, avatar_url: nextAvatar }
      const updated = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select('id')
      if (updated.error) throw updated.error
      if (!updated.data?.length) {
        const inserted = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          display_name: storedName,
          avatar_url: nextAvatar,
        })
        if (inserted.error) throw inserted.error
      }

      setRecord({ displayName: storedName, avatarUrl: nextAvatar })
      setLoaded(true)
    },
    [record.avatarUrl, user],
  )

  const value = useMemo<ProfileContextValue>(
    () => ({
      loaded,
      record,
      displayName: resolveDisplayName(user, record),
      avatarSrc: resolveAvatarSrc(user, record),
      refresh,
      save,
    }),
    [loaded, record, refresh, save, user],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
