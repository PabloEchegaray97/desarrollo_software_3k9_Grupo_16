import type { PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { SessionProvider } from '../../features/auth/session'
import { authRoute } from '../routes/auth.routes'
import { RequireSession } from './RequireSession'
import { ShellNavigation } from './ShellNavigation'
import './app-shell.css'

function ShellFrame({ children }: PropsWithChildren) {
  const { pathname } = useLocation()

  if (pathname === authRoute.path) {
    return <div className="app-shell shell--public"><main className="shell-public-main">{children}</main></div>
  }

  return (
    <RequireSession>
      <div className="app-shell">
        <ShellNavigation />
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
