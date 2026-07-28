interface Props {
  src: string | null
  alt?: string
  caption?: string
}

export function OverlayImage({ src, alt = 'Analyzed hand', caption }: Props) {
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/40 text-sm text-ink-muted">
        Overlay will appear here
      </div>
    )
  }
  return (
    <figure className="animate-fade-up overflow-hidden rounded-2xl border border-stone-300/60 bg-stone-900/5 shadow-sm">
      <img src={src} alt={alt} className="block w-full object-contain" />
      {caption && (
        <figcaption className="border-t border-stone-200/80 bg-white/60 px-3 py-2 text-xs text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
