export const THEME_STORAGE_KEY = 'odosoft.theme'
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export interface ThemeTarget {
  dataset: DOMStringMap
  style: Pick<CSSStyleDeclaration, 'colorScheme'>
}

export interface ThemeMediaQuery {
  matches: boolean
  addEventListener(type: 'change', listener: (event: MediaQueryListEvent) => void): void
  removeEventListener(type: 'change', listener: (event: MediaQueryListEvent) => void): void
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && THEME_PREFERENCES.includes(value as ThemePreference)
}

export function readThemePreference(storage: Pick<Storage, 'getItem'> = window.localStorage): ThemePreference {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeThemePreference(
  preference: ThemePreference,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // La preferencia visual sigue funcionando durante la sesión aunque no haya almacenamiento.
  }
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference
}

export function systemThemeQuery(): ThemeMediaQuery {
  return window.matchMedia('(prefers-color-scheme: dark)')
}

export function applyTheme(
  preference: ThemePreference,
  target: ThemeTarget = document.documentElement,
  mediaQuery: ThemeMediaQuery = systemThemeQuery(),
): ResolvedTheme {
  const resolved = resolveTheme(preference, mediaQuery.matches)
  target.dataset.theme = resolved
  target.style.colorScheme = resolved
  return resolved
}

export function subscribeToSystemTheme(
  preference: ThemePreference,
  listener: (theme: ResolvedTheme) => void,
  mediaQuery: ThemeMediaQuery = systemThemeQuery(),
): () => void {
  if (preference !== 'system') return () => undefined
  const handleChange = (event: MediaQueryListEvent) => listener(event.matches ? 'dark' : 'light')
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}

export function applyInitialTheme(): ThemePreference {
  const preference = readThemePreference()
  applyTheme(preference)
  return preference
}
