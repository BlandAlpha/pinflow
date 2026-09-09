import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ThemeMode } from '@shared/types'

interface ThemeContextValue {
  /** 用户选择（默认 system） */
  mode: ThemeMode
  /** 实际生效的主题 */
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolved: 'light',
  setMode: () => undefined
})

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    window.api.themeSnapshot?.mode ?? 'system'
  )
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    void window.api.getPrefs().then((prefs) => setModeState(prefs.theme))
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [resolved])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    void window.api.setTheme(next)
  }, [])

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
