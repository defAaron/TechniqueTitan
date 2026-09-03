import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ApiStatusBanner } from './ApiStatusBanner'
import { CinematicFooter, CinematicNav } from './CinematicChrome'

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  useEffect(() => {
    document.documentElement.classList.add('cinema')
    return () => document.documentElement.classList.remove('cinema')
  }, [])

  useEffect(() => {
    if (!isLanding) return
    document.documentElement.classList.add('landing')
    return () => document.documentElement.classList.remove('landing')
  }, [isLanding])

  return (
    <div className="landing-grain min-h-screen bg-black text-white">
      {isLanding ? (
        <>
          <div className="fixed inset-x-0 top-0 z-50">
            <ApiStatusBanner />
          </div>
          {children}
        </>
      ) : (
        <div className="flex min-h-screen flex-col">
          <ApiStatusBanner />
          <CinematicNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-14 sm:px-10">
            {children}
          </main>
          <CinematicFooter />
        </div>
      )}
    </div>
  )
}
