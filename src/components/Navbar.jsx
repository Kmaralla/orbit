import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <nav style={{
      borderBottom: '1px solid #0f0f1f',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 60,
      background: '#080810',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div
        style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#e8e4f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => navigate('/dashboard')}
      >
        <span style={{ color: '#6c63ff' }}>●</span> Orbit
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
          fontFamily: 'Syne, sans-serif',
        }}>{initials}</div>
        <button
          onClick={signOut}
          style={{
            background: 'none', border: '1px solid #1a1a2e', borderRadius: 8,
            padding: '6px 14px', color: '#4a4870', cursor: 'pointer',
            fontSize: 13, fontFamily: 'DM Sans, sans-serif',
          }}
        >Sign out</button>
      </div>
    </nav>
  )
}
