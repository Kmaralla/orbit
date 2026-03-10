import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const ORBITS = [
  { emoji: '👴', label: "Dad's Health" },
  { emoji: '👧', label: "Kids Routine" },
  { emoji: '💼', label: "Career Growth" },
  { emoji: '🧘', label: "Mindfulness" },
  { emoji: '💪', label: "Fitness" },
  { emoji: '📚', label: "Learning" },
]

export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
      background: '#080810',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      overflow: 'hidden',
    },
    left: {
      padding: '60px 64px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
    },
    orb: {
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(80px)',
      pointerEvents: 'none',
    },
    right: {
      background: '#0d0d1a',
      borderLeft: '1px solid #1a1a2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 64px',
    },
    logo: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: '-0.5px',
      color: '#e8e4f0',
    },
    logoAccent: { color: '#6c63ff' },
    headline: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 56,
      fontWeight: 800,
      lineHeight: 1.05,
      letterSpacing: '-2px',
      color: '#e8e4f0',
      marginBottom: 24,
    },
    subline: {
      fontSize: 17,
      color: '#6b6890',
      lineHeight: 1.6,
      maxWidth: 420,
      marginBottom: 48,
    },
    orbitGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 10,
      maxWidth: 360,
    },
    orbitChip: {
      background: '#0f0f1f',
      border: '1px solid #1e1e32',
      borderRadius: 12,
      padding: '12px 14px',
      fontSize: 13,
      color: '#4a4870',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    form: { width: '100%', maxWidth: 400 },
    formTitle: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 30,
      fontWeight: 700,
      color: '#e8e4f0',
      marginBottom: 8,
    },
    formSub: { fontSize: 14, color: '#4a4870', marginBottom: 36 },
    input: {
      width: '100%',
      background: '#0a0a16',
      border: '1px solid #1e1e32',
      borderRadius: 12,
      padding: '14px 18px',
      fontSize: 15,
      color: '#e8e4f0',
      outline: 'none',
      marginBottom: 12,
      fontFamily: 'DM Sans, sans-serif',
      transition: 'border-color 0.2s',
    },
    btn: {
      width: '100%',
      background: 'linear-gradient(135deg, #6c63ff 0%, #9b59b6 100%)',
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
      color: '#4a4870',
    },
    toggleLink: {
      color: '#6c63ff',
      cursor: 'pointer',
      marginLeft: 4,
      textDecoration: 'underline',
    },
    error: { color: '#ff6b8a', fontSize: 13, marginTop: 8, textAlign: 'center' },
    success: { color: '#63ffb4', fontSize: 13, marginTop: 8, textAlign: 'center' },
  }

  return (
    <div style={s.page}>
      {/* Left panel */}
      <div style={s.left}>
        {/* Background orbs */}
        <div style={{ ...s.orb, width: 400, height: 400, background: '#6c63ff22', top: -100, left: -100 }} />
        <div style={{ ...s.orb, width: 300, height: 300, background: '#9b59b622', bottom: 50, right: -50 }} />

        <div style={s.logo}>
          <span style={s.logoAccent}>●</span> Orbit
        </div>

        <div>
          <h1 style={s.headline}>
            Track every<br />
            orbit of<br />
            <span style={{ color: '#6c63ff' }}>your life.</span>
          </h1>
          <p style={s.subline}>
            Daily check-ins for the things that matter most — family health, career, kids, wellness. AI-powered insights, weekly trends, and gentle reminders.
          </p>
          <div style={s.orbitGrid}>
            {ORBITS.map(o => (
              <div key={o.label} style={s.orbitChip}>
                <span>{o.emoji}</span>
                <span>{o.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 13, color: '#2a2840' }}>
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
              onFocus={e => e.target.style.borderColor = '#6c63ff'}
              onBlur={e => e.target.style.borderColor = '#1e1e32'}
            />
          )}
          <input
            style={s.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={e => e.target.style.borderColor = '#6c63ff'}
            onBlur={e => e.target.style.borderColor = '#1e1e32'}
          />
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={e => e.target.style.borderColor = '#6c63ff'}
            onBlur={e => e.target.style.borderColor = '#1e1e32'}
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
