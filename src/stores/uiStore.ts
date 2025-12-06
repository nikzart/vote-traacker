import { create } from 'zustand'

interface UIState {
  // Sidebar state for admin
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Toast/notification messages
  toastMessage: { type: 'success' | 'error' | 'info'; message: string } | null
  showToast: (type: 'success' | 'error' | 'info', message: string) => void
  clearToast: () => void

  // Selected items for admin
  selectedDistrictId: string | null
  selectedLocalBodyId: string | null
  selectedWardId: string | null
  setSelectedDistrictId: (id: string | null) => void
  setSelectedLocalBodyId: (id: string | null) => void
  setSelectedWardId: (id: string | null) => void
  clearSelections: () => void
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Toast
  toastMessage: null,
  showToast: (type, message) => {
    set({ toastMessage: { type, message } })
    // Auto-clear after 3 seconds
    setTimeout(() => set({ toastMessage: null }), 3000)
  },
  clearToast: () => set({ toastMessage: null }),

  // Selections
  selectedDistrictId: null,
  selectedLocalBodyId: null,
  selectedWardId: null,
  setSelectedDistrictId: (id) => set({
    selectedDistrictId: id,
    selectedLocalBodyId: null,
    selectedWardId: null
  }),
  setSelectedLocalBodyId: (id) => set({
    selectedLocalBodyId: id,
    selectedWardId: null
  }),
  setSelectedWardId: (id) => set({ selectedWardId: id }),
  clearSelections: () => set({
    selectedDistrictId: null,
    selectedLocalBodyId: null,
    selectedWardId: null
  }),
}))
