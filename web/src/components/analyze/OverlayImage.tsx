interface Props {
  src: string | null
  alt?: string
  caption?: string
}

export function OverlayImage({ src, alt = 'Analyzed hand', caption }: Props) {
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-line bg-surface/50 text-sm text-muted">
        Overlay will appear here
      </div>
    )
  }
  return (
    <figure className="animate-fade-up overflow-hidden rounded-2xl border border-line bg-background">
      <img src={src} alt={alt} className="block w-full object-contain" />
      {caption && (
        <figcaption className="border-t border-line bg-surface px-3 py-2 text-xs text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
