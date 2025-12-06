import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Users, UsersRound, Eye, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/portal', icon: Users, label: 'Voters', end: true },
  { path: '/portal/groups', icon: UsersRound, label: 'Groups' },
  { path: '/portal/readonly', icon: Eye, label: 'View Only' },
]

export default function PortalLayout() {
  const navigate = useNavigate()
  const { clearPortalSession, portalSession } = useAuthStore()

  const handleLogout = () => {
    clearPortalSession()
    navigate('/portal/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <div>
            <h1 className="font-semibold text-sm">Ward Access Portal</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {portalSession?.username}
              {portalSession?.is_master && ' (Master)'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-5 w-5", isActive && "fill-current")} />
                  <span className="text-xs font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
