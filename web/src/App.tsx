import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth'
import { Layout } from './components/layout'
import { AuthProvider } from './lib/auth'
import { AboutPage } from './pages/AboutPage'
import { AdminStatsPage } from './pages/AdminStatsPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { LivePractice } from './pages/LivePractice'
import { PhotoAnalyze } from './pages/PhotoAnalyze'
import { VideoAnalyze } from './pages/VideoAnalyze'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/photo" element={<PhotoAnalyze />} />
              <Route path="/video" element={<VideoAnalyze />} />
              <Route path="/live" element={<LivePractice />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminStatsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
