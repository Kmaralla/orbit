import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme, bgColors } from '../hooks/useTheme'

const ORBITS = [
  { emoji: '👴', label: "Dad's Health" },
  { emoji: '👧', label: "Kids Routine" },
  { emoji: '💼', label: "Career Growth" },
]

const HOW_IT_WORKS = [
  { step: '1', icon: '🎯', title: 'Create Orbits', desc: 'Set up areas you want to track' },
  { step: '2', icon: '✓', title: 'Daily Check-in', desc: '30 seconds to log progress' },
  { step: '3', icon: '📊', title: 'See Patterns', desc: 'Orbit AI finds trends & actions' },
]

// Typewriter demo sequence
const TYPEWRITER_DEMO = [
  { type: 'title', text: 'Example: Tracking Dad\'s Health' },
  { type: 'step', text: '→ Create orbit: "Dad\'s Health" 👴' },
  { type: 'item', text: '  ☑️ Did dad take morning meds?' },
  { type: 'item', text: '  ⭐ Energy level today (1-10)' },
  { type: 'item', text: '  🔢 Blood pressure reading' },
  { type: 'item', text: '  📝 Any symptoms or notes' },
  { type: 'step', text: '→ Check in daily in 30 seconds' },
  { type: 'step', text: '→ Orbit AI spots patterns & trends ✨' },
]

export default function Landing() {
  const { user, loading: authLoading } = useAuth()
  const { colors, theme, toggleTheme, bgColor, setBgColor } = useTheme()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const [typewriterIndex, setTypewriterIndex] = useState(0)
  const [typewriterText, setTypewriterText] = useState('')
  const [currentLine, setCurrentLine] = useState(0)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Typewriter effect
  useEffect(() => {
    if (currentLine >= TYPEWRITER_DEMO.length) {
      // Reset after showing all lines
      const resetTimer = setTimeout(() => {
        setCurrentLine(0)
        setTypewriterIndex(0)
        setTypewriterText('')
      }, 3000)
      return () => clearTimeout(resetTimer)
    }

    const line = TYPEWRITER_DEMO[currentLine].text
    if (typewriterIndex < line.length) {
      const timer = setTimeout(() => {
        setTypewriterText(prev => prev + line[typewriterIndex])
        setTypewriterIndex(prev => prev + 1)
      }, 40)
      return () => clearTimeout(timer)
    } else {
      // Move to next line
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1)
        setTypewriterIndex(0)
        setTypewriterText('')
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [typewriterIndex, currentLine])

  // Wait for session check before rendering anything — prevents login flash for returning users
  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080810' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #6c63ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (user) { navigate('/dashboard'); return null }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
    if (error) { setError(error.message); setLoading(false) }
    // On success, browser redirects to Google — no further action needed
  }

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
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      overflow: 'hidden',
      transition: 'background 0.3s ease',
    },
    left: {
      flex: 1,
      padding: isMobile ? '28px 20px' : '48px 56px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
    },
    orb: {
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(100px)',
      pointerEvents: 'none',
      opacity: theme === 'light' ? 0.4 : 0.6,
    },
    right: {
      flex: isMobile ? 'none' : '0 0 420px',
      background: colors.bgCard,
      borderLeft: isMobile ? 'none' : `1px solid ${colors.border}`,
      borderTop: isMobile ? `1px solid ${colors.border}` : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '28px 20px 40px' : '48px 40px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isMobile ? 28 : 0,
    },
    logo: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: isMobile ? 24 : 28,
      fontWeight: 800,
      letterSpacing: '-1px',
      color: colors.text,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    logoAccent: {
      color: colors.accent,
      fontSize: isMobile ? 20 : 24,
    },
    themeArea: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    toggleContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 24,
      padding: '6px 12px',
    },
    toggleLabel: {
      fontSize: 18,
    },
    toggleSwitch: {
      width: 48,
      height: 26,
      borderRadius: 13,
      background: theme === 'dark' ? colors.accent : colors.border,
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 0.2s',
    },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      position: 'absolute',
      top: 3,
      left: theme === 'dark' ? 25 : 3,
      transition: 'left 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    },
    colorBtn: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: 14,
      color: colors.textMuted,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    colorDropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 8,
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 8,
      display: 'flex',
      gap: 6,
      zIndex: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    },
    colorOption: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      cursor: 'pointer',
      border: '2px solid transparent',
      transition: 'transform 0.15s, border-color 0.15s',
    },
    headline: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: isMobile ? 42 : 64,
      fontWeight: 800,
      lineHeight: 1.0,
      letterSpacing: '-3px',
      color: colors.text,
      marginBottom: 20,
    },
    subline: {
      fontSize: isMobile ? 16 : 18,
      color: colors.textMuted,
      lineHeight: 1.6,
      maxWidth: 440,
      marginBottom: isMobile ? 28 : 40,
      fontFamily: 'Nunito, sans-serif',
    },
    orbitGrid: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
    },
    orbitChip: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 24,
      padding: '10px 16px',
      fontSize: 14,
      color: colors.text,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'Nunito, sans-serif',
      fontWeight: 500,
    },
    howSection: {
      marginTop: isMobile ? 28 : 40,
      paddingTop: isMobile ? 24 : 32,
      borderTop: `1px solid ${colors.border}`,
    },
    howTitle: {
      fontSize: 13,
      color: colors.textMuted,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      marginBottom: 16,
      fontFamily: 'Nunito, sans-serif',
      fontWeight: 600,
    },
    howGrid: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: 12,
    },
    howCard: {
      flex: 1,
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: isMobile ? '14px 16px' : '20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    },
    howStep: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: colors.accentGradient,
      color: '#fff',
      fontSize: 15,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontFamily: 'Nunito, sans-serif',
    },
    howCardContent: {
      flex: 1,
    },
    howCardTitle: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 15,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 2,
    },
    howCardDesc: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: 'Nunito, sans-serif',
    },
    form: { width: '100%', maxWidth: 360 },
    formTitle: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: isMobile ? 28 : 32,
      fontWeight: 800,
      color: colors.text,
      marginBottom: 8,
      letterSpacing: '-1px',
    },
    formSub: {
      fontSize: 15,
      color: colors.textMuted,
      marginBottom: 32,
      fontFamily: 'Nunito, sans-serif',
    },
    input: {
      width: '100%',
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '14px 16px',
      fontSize: 16,
      color: colors.text,
      outline: 'none',
      marginBottom: 12,
      fontFamily: 'Nunito, sans-serif',
      transition: 'border-color 0.2s',
    },
    btn: {
      width: '100%',
      background: colors.accentGradient,
      border: 'none',
      borderRadius: 12,
      padding: '16px',
      fontSize: 16,
      fontWeight: 600,
      color: '#fff',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1,
      marginTop: 8,
      fontFamily: 'Nunito, sans-serif',
    },
    toggle: {
      textAlign: 'center',
      marginTop: 24,
      fontSize: 15,
      color: colors.textMuted,
      fontFamily: 'Nunito, sans-serif',
    },
    toggleLink: {
      color: colors.accent,
      cursor: 'pointer',
      marginLeft: 4,
      fontWeight: 600,
    },
    error: { color: '#ff6b8a', fontSize: 14, marginTop: 12, textAlign: 'center' },
    success: { color: '#63ffb4', fontSize: 14, marginTop: 12, textAlign: 'center' },
    footer: {
      fontSize: 13,
      color: colors.textDim,
      marginTop: isMobile ? 28 : 0,
      fontFamily: 'Nunito, sans-serif',
    },
  }

  const getColorPreview = (key) => {
    const opt = bgColors.find(b => b.key === key)
    return theme === 'dark' ? opt?.dark : opt?.light
  }

  return (
    <div style={s.page}>
      {/* Left panel */}
      <div style={s.left}>
        {/* Background orbs */}
        <div style={{ ...s.orb, width: isMobile ? 250 : 450, height: isMobile ? 250 : 450, background: '#6c63ff33', top: -120, left: -120 }} />
        <div style={{ ...s.orb, width: isMobile ? 180 : 350, height: isMobile ? 180 : 350, background: '#9b59b633', bottom: 30, right: -80 }} />

        <div style={s.header}>
          <div style={s.logo}>
            <span style={s.logoAccent}>●</span> Orbit
          </div>
          <div style={s.themeArea}>
            {/* Color picker */}
            <div style={{ position: 'relative' }}>
              <button
                style={s.colorBtn}
                onClick={() => setShowColors(!showColors)}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: getColorPreview(bgColor),
                  border: `1px solid ${colors.border}`,
                }} />
                <span style={{ fontSize: 12 }}>▼</span>
              </button>
              {showColors && (
                <div style={s.colorDropdown}>
                  {bgColors.map(c => (
                    <div
                      key={c.key}
                      style={{
                        ...s.colorOption,
                        background: theme === 'dark' ? c.dark : c.light,
                        borderColor: bgColor === c.key ? colors.accent : 'transparent',
                        transform: bgColor === c.key ? 'scale(1.1)' : 'scale(1)',
                      }}
                      onClick={() => { setBgColor(c.key); setShowColors(false) }}
                      title={c.label}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <div style={s.toggleContainer}>
              <span style={s.toggleLabel}>☀️</span>
              <div style={s.toggleSwitch} onClick={toggleTheme}>
                <div style={s.toggleKnob} />
              </div>
              <span style={s.toggleLabel}>🌙</span>
            </div>
          </div>
        </div>

        <div>
          {/* Typewriter Demo - First */}
          <div style={{
            marginBottom: 28,
            background: colors.bgCard,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: isMobile ? 16 : 20,
            fontFamily: 'monospace',
            fontSize: isMobile ? 12 : 14,
            minHeight: isMobile ? 180 : 160,
          }}>
            <div style={{ color: colors.accent, marginBottom: 14, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: isMobile ? 15 : 17, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: isMobile ? 16 : 18 }}>✨</span> See how it works
            </div>
            {TYPEWRITER_DEMO.slice(0, currentLine).map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.type === 'title' ? colors.accent : line.type === 'step' ? colors.text : colors.textMuted,
                  fontWeight: line.type === 'title' ? 700 : 400,
                  marginBottom: 4,
                  fontFamily: line.type === 'title' ? 'Nunito, sans-serif' : 'monospace',
                }}
              >
                {line.text}
              </div>
            ))}
            {currentLine < TYPEWRITER_DEMO.length && (
              <div style={{
                color: TYPEWRITER_DEMO[currentLine].type === 'title' ? colors.accent
                  : TYPEWRITER_DEMO[currentLine].type === 'step' ? colors.text
                  : colors.textMuted,
                fontWeight: TYPEWRITER_DEMO[currentLine].type === 'title' ? 700 : 400,
                fontFamily: TYPEWRITER_DEMO[currentLine].type === 'title' ? 'Nunito, sans-serif' : 'monospace',
              }}>
                {typewriterText}<span style={{ opacity: 0.7, animation: 'blink 1s infinite' }}>|</span>
              </div>
            )}
          </div>
          <style>{`@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }`}</style>

          <h1 style={s.headline}>
            Track what<br />
            matters<br />
            <span style={{ color: colors.accent }}>most.</span>
          </h1>
          <p style={s.subline}>
            Create orbits for different areas of your life. Check in daily. Get Orbit AI insights on your patterns.
          </p>
          <div style={s.orbitGrid}>
            {ORBITS.map(o => (
              <div key={o.label} style={s.orbitChip}>
                <span style={{ fontSize: 18 }}>{o.emoji}</span>
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
          Small habits, big life · <span style={{ color: colors.textMuted, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/privacy')}>Privacy Policy</span>
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

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: '#fff',
              border: '1.5px solid #e0dde8',
              borderRadius: 12,
              padding: '13px 20px',
              fontSize: 15,
              fontWeight: 600,
              color: '#1a1a2e',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Nunito, sans-serif',
              marginBottom: 16,
              transition: 'border-color 0.2s, box-shadow 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6c63ff'; e.currentTarget.style.boxShadow = '0 0 0 3px #6c63ff18' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0dde8'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: colors.border }} />
            <span style={{ fontSize: 12, color: colors.textDim }}>or use email</span>
            <div style={{ flex: 1, height: 1, background: colors.border }} />
          </div>

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
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </span>
          </p>

          <div style={{
            marginTop: 24,
            paddingTop: 24,
            borderTop: `1px solid ${colors.border}`,
            textAlign: 'center'
          }}>
            <button
              style={{
                background: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 14,
                color: colors.textMuted,
                cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
                transition: 'all 0.2s',
              }}
              onClick={() => navigate('/demo')}
              onMouseEnter={e => { e.target.style.borderColor = colors.accent; e.target.style.color = colors.accent }}
              onMouseLeave={e => { e.target.style.borderColor = colors.border; e.target.style.color = colors.textMuted }}
            >
              👀 Try as Guest
            </button>
            <p style={{ fontSize: 12, color: colors.textDim, marginTop: 8 }}>
              Explore with sample data, no signup needed
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
