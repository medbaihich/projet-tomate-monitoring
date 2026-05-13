import { useEffect, useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { createAppTheme } from './theme'
import { THEME_STORAGE_KEY, ThemeModeContext } from './theme-mode-context'

const VALID_THEME_MODES = ['dark', 'light']

function resolveInitialThemeMode() {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const rootTheme = document.documentElement.dataset.theme
  if (VALID_THEME_MODES.includes(rootTheme)) {
    return rootTheme
  }

  try {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (VALID_THEME_MODES.includes(storedMode)) {
      return storedMode
    }
  } catch {
    return 'dark'
  }

  return 'dark'
}

function applyThemeMode(mode) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(resolveInitialThemeMode)
  const theme = useMemo(() => createAppTheme(mode), [mode])

  useEffect(() => {
    applyThemeMode(mode)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      // Ignore localStorage write failures and keep the active in-memory mode.
    }
  }, [mode])

  const contextValue = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  )

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}
