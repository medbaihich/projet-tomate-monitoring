import { createContext, useContext } from 'react'

export const THEME_STORAGE_KEY = 'smart-eye-theme-mode'

export const ThemeModeContext = createContext({
  mode: 'dark',
  setMode: () => {},
  toggleMode: () => {},
})

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
