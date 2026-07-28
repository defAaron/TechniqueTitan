export function AboutPage() {
  return (
    <article className="animate-fade-up prose prose-stone max-w-2xl">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">About</h1>
      <p className="mt-3 text-ink-muted leading-relaxed">
        Technique Titan detects hand landmarks, scores five piano posture criteria, and
        returns prioritized coaching. The scoring engine is Python (MediaPipe + geometry);
        this site is the React product UI.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        <li>Wrist height</li>
        <li>Finger curvature</li>
        <li>Thumb position</li>
        <li>Wrist lateral deviation</li>
        <li>Overall hand arch</li>
      </ul>
      <p className="mt-4 text-sm text-ink-muted">
        Live mode prefers browser-side MediaPipe Hands and posts compact landmarks to the
        API so video stays on your device. Frame-upload mode is available as a fallback.
      </p>
    </article>
  )
}
