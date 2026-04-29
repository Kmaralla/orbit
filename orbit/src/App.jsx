import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Usecase from './pages/Usecase'
import Stats from './pages/Stats'
import Privacy from './pages/Privacy'
import Demo from './pages/Demo'
import QuickCheckin from './pages/QuickCheckin'
import Analytics from './pages/Analytics'
import GuestCheckin from './pages/GuestCheckin'
import SideQuests from './pages/SideQuests'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { colors } = useTheme()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: colors.bg }}>
      <div style={{ width: 40, height: 40, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  return user ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/usecase/:id" element={<ProtectedRoute><Usecase /></ProtectedRoute>} />
            <Route path="/usecase/:id/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
            <Route path="/quick-checkin" element={<ProtectedRoute><QuickCheckin /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/checkin/:token" element={<GuestCheckin />} />
            <Route path="/side-quests" element={<ProtectedRoute><SideQuests /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
