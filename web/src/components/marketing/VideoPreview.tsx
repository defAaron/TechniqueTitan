import { useState } from 'react'
import { Reveal } from '../ui/Reveal'

const YOUTUBE_ID = 'WdPEZ5SGXdc'
const YOUTUBE_WATCH = `https://www.youtube.com/watch?v=${YOUTUBE_ID}`
const THUMB =
  `https://i.ytimg.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`

/**
 * Click-to-play YouTube preview for the landing page.
 * Loads the iframe only after the visitor opts in, so the hero stays light.
 */
export function VideoPreview() {
  const [playing, setPlaying] = useState(false)

  return (
    <Reveal as="section" aria-labelledby="demo-heading" className="relative">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            Watch
          </p>
          <h2
            id="demo-heading"
            className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            See the pipeline in action
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            A short video walking through my journey of creating this project: the inspiration, landmark detection, and coaching pipeline behind the project.
          </p>
        </div>
        <a
          href={YOUTUBE_WATCH}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-accent transition-colors hover:text-primary-bright"
        >
          Open on YouTube →
        </a>
      </div>

      <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface glow-blue">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70"
        />

        <div className="relative aspect-video w-full bg-background">
          {playing ? (
            <iframe
              title="Technique Titan demo"
              src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute inset-0 block h-full w-full cursor-pointer text-left"
              aria-label="Play Technique Titan demo video"
            >
              <img
                src={THUMB}
                alt=""
                className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:opacity-95 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-primary/20"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="grid h-16 w-16 place-items-center rounded-full border border-accent/50 bg-background/70 text-accent glow-cyan backdrop-blur-md transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20">
                  <svg
                    viewBox="0 0 24 24"
                    className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8"
                    aria-hidden="true"
                  >
                    <path d="M8 5.5v13l11-6.5-11-6.5z" />
                  </svg>
                </span>
              </div>
              <span className="absolute bottom-4 left-4 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur-sm sm:bottom-5 sm:left-5">
                Demo · YouTube
              </span>
            </button>
          )}
        </div>
      </div>
    </Reveal>
  )
}
