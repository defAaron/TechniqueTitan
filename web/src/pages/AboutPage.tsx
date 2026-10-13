import { PageHeader } from '../components/layout'

const REPO_URL = 'https://github.com/defAaron/TechniqueTitan'

const socialLinks = [
  {
    href: 'https://aarondutta.com',
    label: 'Website',
    detail: 'aarondutta.com',
  },
  {
    href: 'https://linkedin.com/in/aaron-dutta',
    label: 'LinkedIn',
    detail: 'linkedin.com/in/aaron-dutta',
  },
  {
    href: 'https://x.com/theaar0ndutta',
    label: 'X',
    detail: 'x.com/theaar0ndutta',
  },
  {
    href: 'https://youtube.com/@aaron_dutta',
    label: 'YouTube',
    detail: 'youtube.com/@aaron_dutta',
  },
]

const linkClass =
  'text-white underline decoration-white/20 underline-offset-4 transition-colors hover:decoration-white'

export function AboutPage() {
  return (
    <article className="animate-fade-up max-w-3xl">
      <PageHeader title="About">
        TechniqueTitan already has several users, one of them being the creator himself:{' '}
        <a href="https://aarondutta.com" target="_blank" rel="noreferrer" className={linkClass}>
          Aaron Dutta
        </a>
        . He started this project from a gap that every serious pianist knows: practicing alone
        with no one to correct your posture.
      </PageHeader>

      <section aria-labelledby="inspiration-heading" className="mt-14">
        <p className="mb-4 font-body text-sm uppercase tracking-[0.4em] text-white/40">01</p>
        <h2 id="inspiration-heading" className="font-cinematic text-3xl font-normal text-white">
          The inspiration:
        </h2>
        <div className="mt-5 space-y-4 font-body text-base font-light leading-relaxed text-white/50">
          <p>
            Good piano technique lives in small details. A wrist that stays level with keys and
            acts as a bridge for force. Fingers that hold a natural curve and can be implanted
            into the keys with sufficient force to play music with depth. A thumb that doesn’t
            bend too much or tuck under the hand, and rather rests on the side waiting to spring
            into action. These habits decide tone, speed, and comfort. Simultaneously, with
            practice, they also quietly drift. A collapsed wrist feels normal after a few days,
            but by the time it hurts or a teacher catches it, the motion is already muscle
            memory.
          </p>
          <p>
            Lessons always help, but the main issue is that they are infrequent. Between them,
            students reinforce whatever their hands already do. This takes on a snowball effect,
            where the more they practice with bad posture, the easier it is to get used to it,
            worsen it, and continue to weaken technique. Self-taught players and remote learners
            often get no posture feedback at all. Mirrors and phone recordings only work if you
            know exactly what to look for, and even if you do, examining it frame by frame is
            extremely tedious to say the least.
          </p>
          <p>
            Technique Titan ensures that these problems are non-existent for all pianists. It
            turns an ordinary camera into a second pair of eyes. Detect hands, measure five
            posture criteria with geometry, score them consistently, and return coaching tips that
            matter the most at that very moment. No wearables or special hardware are needed, and
            landmarks stay on your device for easy visualization of where the user goes wrong.
          </p>
        </div>
      </section>

      <section aria-labelledby="creator-heading" className="mt-16">
        <p className="mb-4 font-body text-sm uppercase tracking-[0.4em] text-white/40">02</p>
        <h2 id="creator-heading" className="font-cinematic text-3xl font-normal text-white">
          The creator:
        </h2>
        <div className="mt-5 space-y-4 font-body text-base font-light leading-relaxed text-white/50">
          <p>
            TechniqueTitan was built by Aaron Dutta, an award-winning pianist with fourteen years
            of experience who is studying mathematics and computer science at the University of
            Waterloo. He is currently preparing for his ARCT Diploma certificate from the Royal
            Conservatory of Music. Aaron made this project out of his love and interest for the
            piano, and his eagerness to fix simple things that often go unnoticed with software.
            At the start of this project’s creation, Aaron had zero experience and knowledge in
            developing computer vision software, and diligently took the time to learn the nitty
            gritty of how CV works. Take a look at the{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={linkClass}>
              GitHub repo
            </a>{' '}
            (yes, this is an open-source project) to see how TechniqueTitan was made. Check out
            Aaron’s socials as well to see what he’s building currently, and don’t be afraid to
            shoot him a follow or connection request.
          </p>
        </div>

        <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
          <li>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-3 py-4 transition-colors duration-300 hover:text-white"
            >
              <span className="font-cinematic text-base text-white">GitHub</span>
              <span className="truncate font-body text-sm text-white/40 transition-colors group-hover:text-white/70">
                github.com/defAaron/TechniqueTitan
              </span>
            </a>
          </li>
          {socialLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 py-4 transition-colors duration-300 hover:text-white"
              >
                <span className="font-cinematic text-base text-white">{link.label}</span>
                <span className="truncate font-body text-sm text-white/40 transition-colors group-hover:text-white/70">
                  {link.detail}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
