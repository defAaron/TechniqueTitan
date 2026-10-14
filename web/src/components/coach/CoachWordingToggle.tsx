import { useEffect } from 'react'
import {
  coachModelSourceConfig,
  resumeCoachModelFromPref,
  setCoachModelEnabled,
  useCoachModel,
  type CoachModelState,
} from '../../lib/coachModel'

function statusText({ status, progress }: CoachModelState): string {
  switch (status) {
    case 'unsupported':
      return 'This browser can’t run on-device wording.'
    case 'loading':
      return progress == null
        ? 'Preparing on-device wording… standard tips stay on screen.'
        : `Downloading on-device wording… ${progress}%. Standard tips stay on screen.`
    case 'ready':
      return 'On. If a sentence fails our checks, the standard tip is shown.'
    case 'failed':
      return 'On-device wording could not load. Showing standard tips.'
    default:
      return 'Off. Turning it on downloads about 460 MB once, then runs on this device.'
  }
}

/** Opt-in “Varied tip wording”. Renders nothing unless the model repo is configured. */
export function CoachWordingToggle({ className = '' }: { className?: string }) {
  const model = useCoachModel()

  useEffect(() => {
    resumeCoachModelFromPref()
  }, [])

  if (!coachModelSourceConfig) return null

  const checked = model.status === 'loading' || model.status === 'ready'

  return (
    <div className={['max-w-sm', className].join(' ')}>
      <label className="flex cursor-pointer items-center gap-3 font-body text-sm uppercase tracking-[0.18em] text-white/70">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setCoachModelEnabled(event.target.checked)}
          className="h-4 w-4 accent-white"
        />
        Varied tip wording
      </label>
      <p className="mt-1 font-body text-xs text-white/40" role="status">
        {statusText(model)}
      </p>
    </div>
  )
}
