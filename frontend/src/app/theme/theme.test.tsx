import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeProvider.tsx'
import {
  applyInitialTheme,
  applyTheme,
  readThemePreference,
  subscribeToSystemTheme,
  THEME_STORAGE_KEY,
  type ThemeMediaQuery,
} from './theme.ts'

interface MutableMediaQuery extends ThemeMediaQuery {
  emit(matches: boolean): void
}

function mediaQuery(initialMatches: boolean): MutableMediaQuery {
  let listener: ((event: MediaQueryListEvent) => void) | undefined
  return {
    matches: initialMatches,
    addEventListener: (_type, nextListener) => { listener = nextListener },
    removeEventListener: (_type, previousListener) => {
      if (listener === previousListener) listener = undefined
    },
    emit(matches) { listener?.({ matches } as MediaQueryListEvent) },
  }
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('uses system as the safe default and resolves the current scheme', () => {
    const media = mediaQuery(true)
    expect(readThemePreference()).toBe('system')
    expect(applyTheme('system', document.documentElement, media)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('falls back to system when the stored value is corrupt', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readThemePreference()).toBe('system')
  })

  it('reacts to system changes only while the preference is system', () => {
    const media = mediaQuery(false)
    const listener = vi.fn()
    const unsubscribe = subscribeToSystemTheme('system', listener, media)
    media.emit(true)
    expect(listener).toHaveBeenCalledWith('dark')
    unsubscribe()
    media.emit(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('applies the stored preference before mounting and preserves it on reload', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    vi.stubGlobal('matchMedia', () => mediaQuery(false))
    expect(applyInitialTheme()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(readThemePreference()).toBe('dark')
    vi.unstubAllGlobals()
  })

  it('persists an explicit choice through the provider', () => {
    vi.stubGlobal('matchMedia', () => mediaQuery(false))
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.setPreference('dark'))
    expect(result.current.resolvedTheme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    vi.unstubAllGlobals()
  })
})
