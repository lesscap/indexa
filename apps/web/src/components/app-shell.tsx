import { Database, LogOut } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@/app/session'
import { Button } from '@/components/ui/button'

export const AppShell = () => {
  const { session, isResolved, logout } = useSession()
  const location = useLocation()

  if (!isResolved) {
    return <div className="min-h-screen bg-background" />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Indexa
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">Console</p>
            </div>

            <nav className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 p-1">
              <NavLink
                to="/libraries"
                className={({ isActive }) =>
                  [
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
                    isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                  ].join(' ')
                }
              >
                <Database className="h-4 w-4" />
                Libraries
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-border bg-background px-4 py-2 text-sm">
              <span className="text-muted-foreground">{session.domain.name}</span>
              <span className="mx-2 text-border">/</span>
              <span className="font-medium text-foreground">{session.name}</span>
            </div>
            <Button onClick={() => void logout()} size="sm" variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
