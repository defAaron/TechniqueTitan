import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAuthReturnUrl } from '../../lib/auth'
import { ApiStatusBanner } from './ApiStatusBanner'
import { CinematicFooter, CinematicNav } from './CinematicChrome'
import { FloatingAppNav } from './FloatingAppNav'

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { pathname } = location
  const isLanding = pathname === '/'
  const isProgress = pathname === '/progress'

  useEffect(() => {
    document.documentElement.classList.add('cinema')
    return () => document.documentElement.classList.remove('cinema')
  }, [])

  useEffect(() => {
    if (!isLanding) return
    document.documentElement.classList.add('landing')
    return () => document.documentElement.classList.remove('landing')
  }, [isLanding])

  if (pathname !== '/auth/callback' && isAuthReturnUrl(location.search, location.hash)) {
    return <Navigate to={`/auth/callback${location.search}${location.hash}`} replace />
  }

  return (
    <div
      className={
        isLanding
          ? 'landing-grain min-h-screen bg-zinc-950 text-white'
          : isProgress
            ? 'min-h-screen bg-[#050505] text-white'
            : 'landing-grain min-h-screen bg-black text-white'
      }
    >
      <FloatingAppNav />
      {isLanding ? (
        <>
          <div className="fixed inset-x-0 top-0 z-50">
            <ApiStatusBanner />
            <CinematicNav fixed />
          </div>
          {children}
        </>
      ) : (
        <div className="flex min-h-screen flex-col">
          <ApiStatusBanner />
          <CinematicNav />
          <main
            className={
              isProgress
                ? 'mx-auto w-full max-w-[1180px] flex-1 px-6 pb-12 pt-8 sm:px-8'
                : 'mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-11 sm:px-10'
            }
          >
            {children}
          </main>
          {isProgress ? (
            <footer className="border-t border-[#181818] bg-[#050505]/96 px-6 py-3 sm:px-8">
              <p className="mx-auto flex max-w-[1180px] items-center justify-between font-body text-[9px] uppercase tracking-[0.42em] text-[#555]">
                <span>© {new Date().getFullYear()} Technique Titan</span>
                <span className="hidden text-[#343434] sm:inline">Form. Focus. Progress.</span>
              </p>
            </footer>
          ) : (
            <CinematicFooter />
          )}
        </div>
      )}
    </div>
  )
}
