import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme, bgColors } from '../hooks/useTheme'

export default function Navbar() {
  const { user } = useAuth()
  const { colors, theme, toggleTheme, bgColor, setBgColor } = useTheme()
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <nav style={{
      borderBottom: `1px solid ${colors.border}`,
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 60,
      background: colors.bgCard,
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div
        style={{ fontFamily: 'Nunito, sans-serif', fontSize: 20, fontWeight: 800, color: colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => navigate('/dashboard')}
      >
        <span style={{ color: colors.accent }}>●</span> Orbit
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Settings button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: showSettings ? colors.accent + '22' : 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: '6px 10px',
              color: colors.textMuted,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Theme settings"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          {/* Settings dropdown */}
          {showSettings && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 16,
              minWidth: 200,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              zIndex: 100,
            }}>
              {/* Theme toggle */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Theme</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { if (theme !== 'dark') toggleTheme() }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${theme === 'dark' ? colors.accent : colors.border}`,
                      background: theme === 'dark' ? colors.accent + '22' : 'transparent',
                      color: theme === 'dark' ? colors.accent : colors.textMuted,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'Nunito, sans-serif',
                    }}
                  >🌙 Dark</button>
                  <button
                    onClick={() => { if (theme !== 'light') toggleTheme() }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${theme === 'light' ? colors.accent : colors.border}`,
                      background: theme === 'light' ? colors.accent + '22' : 'transparent',
                      color: theme === 'light' ? colors.accent : colors.textMuted,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'Nunito, sans-serif',
                    }}
                  >☀️ Light</button>
                </div>
              </div>

              {/* Background color */}
              <div>
                <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Background</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {bgColors.map(bg => (
                    <button
                      key={bg.key}
                      onClick={() => setBgColor(bg.key)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: `2px solid ${bgColor === bg.key ? colors.accent : colors.border}`,
                        background: theme === 'dark' ? bg.dark : bg.light,
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      title={bg.label}
                    >
                      {bgColor === bg.key && (
                        <span style={{ color: colors.accent, fontSize: 14 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
          fontFamily: 'Nunito, sans-serif',
        }}>{initials}</div>
        <button
          onClick={signOut}
          style={{
            background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8,
            padding: '6px 14px', color: colors.textMuted, cursor: 'pointer',
            fontSize: 13, fontFamily: 'Nunito, sans-serif',
          }}
        >Sign out</button>
      </div>
    </nav>
  )
}
