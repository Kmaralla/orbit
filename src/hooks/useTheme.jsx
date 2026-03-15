import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

// Background color options
export const bgColors = [
  { key: 'default', label: 'Default', dark: '#080810', light: '#faf8f5' },
  { key: 'purple', label: 'Purple', dark: '#0f0818', light: '#f5f0fa' },
  { key: 'blue', label: 'Blue', dark: '#080f18', light: '#f0f5fa' },
  { key: 'pink', label: 'Pink', dark: '#180810', light: '#faf0f5' },
  { key: 'green', label: 'Green', dark: '#081810', light: '#f0faf5' },
  { key: 'orange', label: 'Orange', dark: '#181008', light: '#faf5f0' },
]

export const getThemeColors = (mode, bgKey = 'default') => {
  const bgOption = bgColors.find(b => b.key === bgKey) || bgColors[0]
  const bg = mode === 'dark' ? bgOption.dark : bgOption.light

  if (mode === 'dark') {
    return {
      name: 'dark',
      bg,
      bgCard: '#0d0d1a',
      bgInput: '#0a0a16',
      border: '#1a1a2e',
      borderLight: '#2a2a40',
      accent: '#6c63ff',
      accentGradient: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
      text: '#e8e4f0',
      textMuted: '#8a86a0',
      textDim: '#4a4860',
    }
  }
  return {
    name: 'light',
    bg,
    bgCard: '#ffffff',
    bgInput: '#f5f3f0',
    border: '#e8e4df',
    borderLight: '#d8d4cf',
    accent: '#6c63ff',
    accentGradient: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
    text: '#1a1a2e',
    textMuted: '#5a5868',
    textDim: '#8a88a0',
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orbit-theme') || 'dark'
    }
    return 'dark'
  })

  const [bgColor, setBgColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orbit-bg') || 'default'
    }
    return 'default'
  })

  useEffect(() => {
    localStorage.setItem('orbit-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('orbit-bg', bgColor)
  }, [bgColor])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const colors = getThemeColors(theme, bgColor)

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, bgColor, setBgColor, bgColors }}>
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
