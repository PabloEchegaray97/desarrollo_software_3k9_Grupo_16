import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  subscribeToSystemTheme,
  systemThemeQuery,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './theme.ts'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(preference, systemThemeQuery().matches),
  )

  useEffect(() => {
    const mediaQuery = systemThemeQuery()
    writeThemePreference(preference)
    setResolvedTheme(applyTheme(preference, document.documentElement, mediaQuery))
    return subscribeToSystemTheme(
      preference,
      (theme) => {
        document.documentElement.dataset.theme = theme
        document.documentElement.style.colorScheme = theme
        setResolvedTheme(theme)
      },
      mediaQuery,
    )
  }, [preference])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
