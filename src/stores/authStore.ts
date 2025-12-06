import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PortalSession } from '@/types'

interface AuthState {
  // Portal auth (for Ward Access Portal)
  portalSession: PortalSession | null
  setPortalSession: (session: PortalSession | null) => void
  clearPortalSession: () => void

  // Admin auth (for Admin Dashboard)
  adminEmail: string | null
  isAdminLoggedIn: boolean
  setAdminAuth: (email: string) => void
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
      adminEmail: null,
      isAdminLoggedIn: false,
      setAdminAuth: (email) => set({ adminEmail: email, isAdminLoggedIn: true }),
      clearAdminAuth: () => set({ adminEmail: null, isAdminLoggedIn: false }),
    }),
    {
      name: 'vote-tracker-auth',
      partialize: (state) => ({
        portalSession: state.portalSession,
        adminEmail: state.adminEmail,
        isAdminLoggedIn: state.isAdminLoggedIn,
      }),
    }
  )
)
