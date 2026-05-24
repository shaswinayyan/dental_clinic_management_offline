import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('zd-theme') === 'dark' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    try { localStorage.setItem('zd-theme', isDark ? 'dark' : 'light') } catch { /* noop */ }
  }, [isDark])

  const toggleTheme = () => setIsDark(d => !d)
  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
