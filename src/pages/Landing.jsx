import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const ORBITS = [
  { emoji: '👴', label: "Dad's Health" },
  { emoji: '👧', label: "Kids Routine" },
  { emoji: '💼', label: "Career Growth" },
]

const HOW_IT_WORKS = [
  { step: '1', icon: '🎯', title: 'Create Orbits', desc: 'Set up areas of life you want to track' },
  { step: '2', icon: '✓', title: 'Daily Check-in', desc: '30 seconds to log your progress' },
  { step: '3', icon: '📊', title: 'See Patterns', desc: 'AI finds trends and suggests actions' },
]

export default function Landing() {
  const { user } = useAuth()
  const { colors, theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (user) { navigate('/dashboard'); return null }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else navigate('/dashboard')
    }
    setLoading(false)
  }

  const s = {
    page: {
      minHeight: '100vh',
      background: colors.bg,
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      overflow: 'hidden',
    },
    left: {
      padding: isMobile ? '32px 24px' : '60px 64px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
      minHeight: isMobile ? 'auto' : 'auto',
    },
    orb: {
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(80px)',
      pointerEvents: 'none',
      opacity: theme === 'light' ? 0.5 : 1,
    },
    right: {
      background: colors.bgCard,
      borderLeft: isMobile ? 'none' : `1px solid ${colors.border}`,
      borderTop: isMobile ? `1px solid ${colors.border}` : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '32px 24px' : '60px 64px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isMobile ? 24 : 0,
    },
    logo: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: '-0.5px',
      color: colors.text,
    },
    logoAccent: { color: colors.accent },
    themeToggle: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 20,
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    headline: {
      fontFamily: 'Syne, sans-serif',
      fontSize: isMobile ? 36 : 56,
      fontWeight: 800,
      lineHeight: 1.05,
      letterSpacing: '-2px',
      color: colors.text,
      marginBottom: 24,
    },
    subline: {
      fontSize: isMobile ? 15 : 17,
      color: colors.textMuted,
      lineHeight: 1.6,
      maxWidth: 420,
      marginBottom: isMobile ? 32 : 48,
    },
    orbitGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
      gap: 10,
      maxWidth: 360,
    },
    orbitChip: {
      background: theme === 'light' ? colors.bgInput : '#0f0f1f',
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: isMobile ? '10px 8px' : '12px 14px',
      fontSize: isMobile ? 11 : 13,
      color: colors.textMuted,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    howSection: {
      marginTop: isMobile ? 32 : 40,
      paddingTop: isMobile ? 24 : 32,
      borderTop: `1px solid ${colors.border}`,
    },
    howTitle: {
      fontSize: 11,
      color: colors.textDim,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      marginBottom: 20,
    },
    howGrid: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 20,
    },
    howCard: {
      flex: 1,
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: isMobile ? '16px 14px' : '20px 16px',
      textAlign: 'center',
      display: isMobile ? 'flex' : 'block',
      alignItems: 'center',
      gap: isMobile ? 12 : 0,
    },
    howStep: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: colors.accentGradient,
      color: '#fff',
      fontSize: 13,
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: isMobile ? 0 : 12,
      flexShrink: 0,
    },
    howIcon: {
      fontSize: 24,
      marginBottom: isMobile ? 0 : 8,
      display: isMobile ? 'none' : 'block',
    },
    howCardContent: {
      textAlign: isMobile ? 'left' : 'center',
    },
    howCardTitle: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 14,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 4,
    },
    howCardDesc: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 1.4,
    },
    form: { width: '100%', maxWidth: 400 },
    formTitle: {
      fontFamily: 'Syne, sans-serif',
      fontSize: isMobile ? 24 : 30,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 8,
    },
    formSub: { fontSize: 14, color: colors.textMuted, marginBottom: 36 },
    input: {
      width: '100%',
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '14px 18px',
      fontSize: 15,
      color: colors.text,
      outline: 'none',
      marginBottom: 12,
      fontFamily: 'DM Sans, sans-serif',
      transition: 'border-color 0.2s',
    },
    btn: {
      width: '100%',
      background: colors.accentGradient,
      border: 'none',
      borderRadius: 12,
      padding: '15px',
      fontSize: 15,
      fontWeight: 600,
      color: '#fff',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1,
      marginTop: 8,
      fontFamily: 'DM Sans, sans-serif',
      letterSpacing: '0.3px',
    },
    toggle: {
      textAlign: 'center',
      marginTop: 24,
      fontSize: 14,
      color: colors.textMuted,
    },
    toggleLink: {
      color: colors.accent,
      cursor: 'pointer',
      marginLeft: 4,
      textDecoration: 'underline',
    },
    error: { color: '#ff6b8a', fontSize: 13, marginTop: 8, textAlign: 'center' },
    success: { color: '#63ffb4', fontSize: 13, marginTop: 8, textAlign: 'center' },
    footer: {
      fontSize: 13,
      color: colors.textDim,
      marginTop: isMobile ? 32 : 0,
    },
  }

  return (
    <div style={s.page}>
      {/* Left panel */}
      <div style={s.left}>
        {/* Background orbs */}
        <div style={{ ...s.orb, width: isMobile ? 200 : 400, height: isMobile ? 200 : 400, background: '#6c63ff22', top: -100, left: -100 }} />
        <div style={{ ...s.orb, width: isMobile ? 150 : 300, height: isMobile ? 150 : 300, background: '#9b59b622', bottom: 50, right: -50 }} />

        <div style={s.header}>
          <div style={s.logo}>
            <span style={s.logoAccent}>●</span> Orbit
          </div>
          <button style={s.themeToggle} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <div>
          <h1 style={s.headline}>
            Track what<br />
            matters<br />
            <span style={{ color: colors.accent }}>most.</span>
          </h1>
          <p style={s.subline}>
            Create orbits for different areas of your life. Check in daily. Get AI insights on your patterns.
          </p>
          <div style={s.orbitGrid}>
            {ORBITS.map(o => (
              <div key={o.label} style={s.orbitChip}>
                <span>{o.emoji}</span>
                <span>{o.label}</span>
              </div>
            ))}
          </div>

          <div style={s.howSection}>
            <div style={s.howTitle}>How it works</div>
            <div style={s.howGrid}>
              {HOW_IT_WORKS.map(h => (
                <div key={h.step} style={s.howCard}>
                  <span style={s.howStep}>{h.step}</span>
                  {!isMobile && <span style={s.howIcon}>{h.icon}</span>}
                  <div style={s.howCardContent}>
                    <div style={s.howCardTitle}>{h.title}</div>
                    <div style={s.howCardDesc}>{h.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={s.footer}>
          Free forever · Powered by Claude AI
        </div>
      </div>

      {/* Right panel — form */}
      <div style={s.right}>
        <div style={s.form}>
          <h2 style={s.formTitle}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={s.formSub}>
            {mode === 'login' ? 'Sign in to your Orbit' : 'Start tracking what matters'}
          </p>

          {mode === 'signup' && (
            <input
              style={s.input}
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={e => e.target.style.borderColor = colors.accent}
              onBlur={e => e.target.style.borderColor = colors.border}
            />
          )}
          <input
            style={s.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={e => e.target.style.borderColor = colors.accent}
            onBlur={e => e.target.style.borderColor = colors.border}
          />
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={e => e.target.style.borderColor = colors.accent}
            onBlur={e => e.target.style.borderColor = colors.border}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          <button style={s.btn} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {error && <p style={s.error}>{error}</p>}
          {message && <p style={s.success}>{message}</p>}

          <p style={s.toggle}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <span style={s.toggleLink} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>
              {mode === 'login' ? ' Sign up' : ' Sign in'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
