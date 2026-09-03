interface Props {
  src: string | null
  alt?: string
  caption?: string
}

export function OverlayImage({ src, alt = 'Analyzed hand', caption }: Props) {
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center border border-dashed border-white/20 bg-zinc-950 text-base text-white/40">
        Overlay will appear here
      </div>
    )
  }
  return (
    <figure className="animate-fade-up overflow-hidden border border-white/10 bg-black">
      <img src={src} alt={alt} className="block w-full object-contain" />
      {caption && (
        <figcaption className="border-t border-white/10 bg-zinc-950 px-4 py-3 font-body text-sm text-white/40">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
