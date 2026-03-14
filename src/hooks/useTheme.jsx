import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const themes = {
  dark: {
    name: 'dark',
    bg: '#080810',
    bgCard: '#0d0d1a',
    bgInput: '#0a0a16',
    border: '#1a1a2e',
    borderLight: '#2a2a40',
    accent: '#6c63ff',
    accentGradient: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
    text: '#e8e4f0',
    textMuted: '#4a4870',
    textDim: '#2a2840',
  },
  light: {
    name: 'light',
    bg: '#faf8f5',
    bgCard: '#ffffff',
    bgInput: '#f5f3f0',
    border: '#e8e4df',
    borderLight: '#d8d4cf',
    accent: '#6c63ff',
    accentGradient: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
    text: '#1a1a2e',
    textMuted: '#6a6878',
    textDim: '#9a98a8',
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orbit-theme') || 'dark'
    }
    return 'dark'
  })

  useEffect(() => {
    localStorage.setItem('orbit-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const colors = themes[theme]

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
