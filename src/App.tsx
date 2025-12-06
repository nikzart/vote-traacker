import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'

// Admin pages
import AdminLayout from '@/pages/admin/Layout'
import AdminDashboard from '@/pages/admin/Dashboard'
import WardManagement from '@/pages/admin/WardManagement'
import ImportData from '@/pages/admin/ImportData'
import Credentials from '@/pages/admin/Credentials'
import AdminLogin from '@/pages/admin/Login'

// Portal pages
import PortalLayout from '@/pages/portal/Layout'
import PortalLogin from '@/pages/portal/Login'
import VoterEntry from '@/pages/portal/VoterEntry'
import Groups from '@/pages/portal/Groups'

// Auth guards
import { useAuthStore } from '@/stores/authStore'

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAdminLoggedIn } = useAuthStore()
  if (!isAdminLoggedIn) {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}

function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { portalSession } = useAuthStore()
  if (!portalSession) {
    return <Navigate to="/portal/login" replace />
  }
  return <>{children}</>
}

function App() {
  const { setAdminSession } = useAuthStore()

  // Initialize Supabase auth listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAdminSession(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setAdminSession])

  return (
    <>
      <Routes>
        {/* Home - redirect to portal */}
        <Route path="/" element={<Navigate to="/portal/login" replace />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="wards" element={<WardManagement />} />
          <Route path="import" element={<ImportData />} />
          <Route path="credentials" element={<Credentials />} />
        </Route>

        {/* Portal Routes */}
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route
          path="/portal"
          element={
            <PortalProtectedRoute>
              <PortalLayout />
            </PortalProtectedRoute>
          }
        >
          <Route index element={<VoterEntry />} />
          <Route path="groups" element={<Groups />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
