import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSync, setSync } from '../lib/storage'

type ThemeSetting = 'light' | 'dark' | 'system'
type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  themeSetting: ThemeSetting
  setThemeSetting: (s: ThemeSetting) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', themeSetting: 'system', setThemeSetting: () => {}, toggle: () => {} })

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(setting: ThemeSetting): Theme {
  return setting === 'system' ? getSystemTheme() : setting
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeSetting, setThemeSettingState] = useState<ThemeSetting>('system')
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    getSync('theme').then(stored => {
      const setting: ThemeSetting = (stored as ThemeSetting) ?? 'system'
      setThemeSettingState(setting)
      const resolved = resolveTheme(setting)
      setTheme(resolved)
      applyTheme(resolved)
    })
  }, [])

  useEffect(() => {
    if (themeSetting !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const resolved: Theme = e.matches ? 'dark' : 'light'
      setTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeSetting])

  function setThemeSetting(s: ThemeSetting) {
    setThemeSettingState(s)
    setSync('theme', s)
    const resolved = resolveTheme(s)
    setTheme(resolved)
    applyTheme(resolved)
  }

  function toggle() {
    setThemeSetting(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, themeSetting, setThemeSetting, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
