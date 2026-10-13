import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { PageHeader } from '../components/layout'
import { ProfileAvatar } from '../components/account/ProfileAvatar'
import { imageFileToAvatarBlob } from '../lib/avatarImage'
import { useProfile } from '../lib/profile'

export function EditProfilePage() {
  const { loaded, record, displayName, avatarSrc, save } = useProfile()
  const [name, setName] = useState(displayName)
  const [preview, setPreview] = useState<string | null>(avatarSrc)
  const [file, setFile] = useState<Blob | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loaded) return
    setName(record.displayName?.trim() || displayName)
    setPreview(avatarSrc)
    setFile(null)
    setRemovePhoto(false)
  }, [loaded, record.displayName, displayName, avatarSrc])

  const shown = removePhoto && !file ? null : preview

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    setError(null)
    setSaved(false)
    try {
      const blob = await imageFileToAvatarBlob(picked)
      setFile(blob)
      setRemovePhoto(false)
      setPreview((current) => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
        return URL.createObjectURL(blob)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image.')
    }
  }

  function onRemove() {
    setError(null)
    setSaved(false)
    setFile(null)
    setRemovePhoto(true)
    setPreview((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
      return null
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await save({
        displayName: name,
        file,
        removePhoto: removePhoto && !file,
      })
      setFile(null)
      setRemovePhoto(false)
      setSaved(true)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Could not save your profile.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader eyebrow="Account" title="Edit profile">
        Your name and photo appear in the account menu.
      </PageHeader>

      <form className="space-y-8" onSubmit={(event) => void onSubmit(event)}>
        <div className="flex items-center gap-6">
          <ProfileAvatar src={shown} name={name.trim() || displayName} size="lg" />
          <div className="flex flex-col items-start gap-3">
            <label className="cursor-pointer font-body text-sm uppercase tracking-widest text-white/70 transition-colors hover:text-white">
              {shown ? 'Change photo' : 'Add photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => void onPick(event)}
              />
            </label>
            {shown && (
              <button
                type="button"
                onClick={onRemove}
                className="font-body text-sm uppercase tracking-widest text-[#ef4444] transition-colors hover:text-[#f87171]"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block font-body text-sm uppercase tracking-[0.2em] text-white/40">
            Profile name
          </span>
          <input
            type="text"
            name="displayName"
            autoComplete="nickname"
            maxLength={80}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setSaved(false)
            }}
            className="w-full border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
          />
        </label>

        {error && (
          <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
            {error}
          </p>
        )}
        {saved && (
          <p className="font-body text-base text-white/70" role="status">
            Profile saved.
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !loaded}
          className="bg-white px-6 py-3 font-body text-sm uppercase tracking-widest text-black transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
