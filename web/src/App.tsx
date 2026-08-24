import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout'
import { AboutPage } from './pages/AboutPage'
import { HomePage } from './pages/HomePage'
import { LivePractice } from './pages/LivePractice'
import { PhotoAnalyze } from './pages/PhotoAnalyze'
import { VideoAnalyze } from './pages/VideoAnalyze'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/photo" element={<PhotoAnalyze />} />
            <Route path="/video" element={<VideoAnalyze />} />
            <Route path="/live" element={<LivePractice />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
