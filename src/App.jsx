import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AWSAuthContext'
import ProtectedRoute from './ProtectedRoute'
import Login from './pages/Login'

// Lazy load heavy components for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ExamInterface = lazy(() => import('./pages/ExamInterface'))
const ExamResult = lazy(() => import('./pages/ExamResult'))
const AssignStudentsPage = lazy(() => import('./components/AssignStudentsPage'))

// Loading component for suspense fallback
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666'
  }}>
    <div>🔄 Loading...</div>
  </div>
)

export const AppContext = React.createContext()

export default function App(){
  const [user, setUser] = React.useState({ 
    name: 'Test User', 
    email: 'test@example.com',
    avatar: '👤'
  })
  const [progress, setProgress] = React.useState({
    TCS: { xp: 10, badges: 0, rounds: { aptitude:0, technical:0, coding:0, gaming:0, voice:0 }},
    Cognizant: { xp: 5, badges: 0, rounds: { aptitude:0, technical:0, coding:0, gaming:0, voice:0 }},
    Infosys: { xp: 0, badges: 0, rounds: { aptitude:0, technical:0, coding:0, gaming:0, voice:0 }},
  })

  const ctxValue = { user, setUser, progress, setProgress }

  return (
    <AuthProvider>
      <AppContext.Provider value={ctxValue}>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Login/>} />
            <Route path="/login" element={<Login/>} />
            
            {/* Protected Student Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute requireAuth={true} requireAdmin={false}>
                <Dashboard/>
              </ProtectedRoute>
            } />
            <Route path="/exam/:testId" element={
              <ProtectedRoute requireAuth={true} requireAdmin={false}>
                <ExamInterface/>
              </ProtectedRoute>
            } />
            <Route path="/exam-result" element={
              <ProtectedRoute requireAuth={true} requireAdmin={false}>
                <ExamResult/>
              </ProtectedRoute>
            } />
            
            {/* Protected Admin Routes */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute requireAuth={true} requireAdmin={true}>
                <AdminDashboard/>
              </ProtectedRoute>
            } />
            <Route path="/assign-students" element={
              <ProtectedRoute requireAuth={true} requireAdmin={true}>
                <AssignStudentsPage/>
              </ProtectedRoute>
            } />
            
            {/* Fallback */}
            <Route path="*" element={<Login/>} />
          </Routes>
        </Suspense>
      </AppContext.Provider>
    </AuthProvider>
  )
}
