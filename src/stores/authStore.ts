import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'
import type { PortalSession } from '@/types'

interface AuthState {
  // Portal auth (for Ward Access Portal)
  portalSession: PortalSession | null
  setPortalSession: (session: PortalSession | null) => void
  clearPortalSession: () => void

  // Admin auth (for Admin Dashboard - Supabase Auth)
  adminSession: Session | null
  isAdminLoggedIn: boolean
  setAdminSession: (session: Session | null) => void
  clearAdminAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Portal auth
      portalSession: null,
      setPortalSession: (session) => set({ portalSession: session }),
      clearPortalSession: () => set({ portalSession: null }),

      // Admin auth
      adminSession: null,
      isAdminLoggedIn: false,
      setAdminSession: (session) => set({
        adminSession: session,
        isAdminLoggedIn: !!session
      }),
      clearAdminAuth: () => set({ adminSession: null, isAdminLoggedIn: false }),
    }),
    {
      name: 'vote-tracker-auth',
      partialize: (state) => ({
        portalSession: state.portalSession,
        // Don't persist admin session - Supabase handles it
      }),
    }
  )
)
