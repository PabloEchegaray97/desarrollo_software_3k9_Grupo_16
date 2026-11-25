import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SessionProvider } from '../../features/auth/session'
import { authRoute } from '../routes/auth.routes'
import { RequireSession } from './RequireSession'
import { ShellNavigation } from './ShellNavigation'
import './app-shell.css'

const SIDEBAR_PREFERENCE_KEY = 'odosoft.sidebar-collapsed'

function readSidebarPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === 'true'
  } catch {
    return false
  }
}

function ShellFrame({ children }: PropsWithChildren) {
  const { pathname } = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference)

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(sidebarCollapsed))
    } catch {
      // The shell remains usable when browser storage is unavailable.
    }
  }, [sidebarCollapsed])

  if (pathname === authRoute.path) {
    return <div className="app-shell app-shell--public"><main className="shell-public-main">{children}</main></div>
  }

  return (
    <RequireSession>
      <div className="app-shell" data-sidebar-collapsed={sidebarCollapsed}>
        <ShellNavigation
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />
        <main className="app-main">{children}</main>
      </div>
    </RequireSession>
  )
}

export function AppShell({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <ShellFrame>{children}</ShellFrame>
    </SessionProvider>
  )
}
