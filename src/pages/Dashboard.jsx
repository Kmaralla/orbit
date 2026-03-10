import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Navbar from '../components/Navbar'
import AddUsecase from '../components/AddUsecase'

const ICONS = ['👴', '👧', '💼', '🧘', '💪', '📚', '❤️', '🎯', '🌱', '🏠', '✈️', '🎨']

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [usecases, setUsecases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [todayStats, setTodayStats] = useState({})
  const [copiedId, setCopiedId] = useState(null)

  const copyOrbitLink = async (ucId, e) => {
    e.stopPropagation()
    const link = `${window.location.origin}/usecase/${ucId}`
    await navigator.clipboard.writeText(link)
    setCopiedId(ucId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => { fetchUsecases() }, [user])

  const fetchUsecases = async () => {
    const { data } = await supabase
      .from('usecases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
    setUsecases(data || [])

    // fetch today's checkin counts
    const today = new Date().toISOString().split('T')[0]
    const { data: entries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, checklist_items(usecase_id)')
      .eq('user_id', user.id)
      .eq('date', today)

    const counts = {}
    entries?.forEach(e => {
      const uid = e.checklist_items?.usecase_id
      if (uid) counts[uid] = (counts[uid] || 0) + 1
    })
    setTodayStats(counts)
    setLoading(false)
  }

  const deleteUsecase = async (id) => {
    await supabase.from('usecases').delete().eq('id', id)
    setUsecases(prev => prev.filter(u => u.id !== id))
  }

  const s = {
    page: { minHeight: '100vh', background: '#080810' },
    content: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 },
    greeting: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 36,
      fontWeight: 700,
      color: '#e8e4f0',
      letterSpacing: '-1px',
    },
    greetingSub: { fontSize: 15, color: '#4a4870', marginTop: 6 },
    addBtn: {
      background: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
      border: 'none',
      borderRadius: 12,
      padding: '12px 24px',
      color: '#fff',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'DM Sans, sans-serif',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: 20,
    },
    card: {
      background: '#0d0d1a',
      border: '1px solid #1a1a2e',
      borderRadius: 20,
      padding: '28px',
      cursor: 'pointer',
      transition: 'border-color 0.2s, transform 0.2s',
      position: 'relative',
      overflow: 'hidden',
    },
    cardIcon: { fontSize: 40, marginBottom: 16 },
    cardName: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 20,
      fontWeight: 700,
      color: '#e8e4f0',
      marginBottom: 6,
    },
    cardDesc: { fontSize: 13, color: '#4a4870', lineHeight: 1.5, marginBottom: 20 },
    cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    badge: {
      background: '#6c63ff22',
      border: '1px solid #6c63ff44',
      borderRadius: 8,
      padding: '5px 12px',
      fontSize: 12,
      color: '#6c63ff',
    },
    actions: { display: 'flex', gap: 8 },
    actionBtn: {
      background: 'transparent',
      border: '1px solid #1e1e32',
      borderRadius: 8,
      padding: '6px 14px',
      fontSize: 12,
      cursor: 'pointer',
      color: '#4a4870',
      fontFamily: 'DM Sans, sans-serif',
    },
    reminderBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: '#2d4a2d',
      border: '1px solid #3d6a3d',
      borderRadius: 6,
      padding: '3px 8px',
      fontSize: 10,
      color: '#7dba7d',
      marginLeft: 8,
    },
    copyBtn: {
      background: 'transparent',
      border: '1px solid #1e1e32',
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 12,
      cursor: 'pointer',
      color: '#4a4870',
      fontFamily: 'DM Sans, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    emptyState: {
      textAlign: 'center',
      padding: '80px 20px',
      color: '#2a2840',
    },
    emptyIcon: { fontSize: 64, marginBottom: 16, display: 'block' },
    emptyTitle: {
      fontFamily: 'Syne, sans-serif',
      fontSize: 24,
      color: '#3a3860',
      marginBottom: 8,
    },
    emptyText: { fontSize: 15, color: '#2a2840', marginBottom: 24 },
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.content}>
        <div style={s.header}>
          <div>
            <h1 style={s.greeting}>{greeting}, {userName} 👋</h1>
            <p style={s.greetingSub}>
              {usecases.length === 0
                ? 'Create your first orbit to start tracking'
                : `You have ${usecases.length} orbit${usecases.length > 1 ? 's' : ''} in motion`}
            </p>
          </div>
          <button style={s.addBtn} onClick={() => setShowAdd(true)}>
            <span>+</span> New Orbit
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 20 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ ...s.card, height: 180, background: '#0d0d1a', animation: 'pulse 1.5s ease infinite' }} />
            ))}
          </div>
        ) : usecases.length === 0 ? (
          <div style={s.emptyState}>
            <span style={s.emptyIcon}>🌌</span>
            <h2 style={s.emptyTitle}>Your orbit is empty</h2>
            <p style={s.emptyText}>Create your first tracking orbit — for Dad's health, your kids, career goals, or anything that matters.</p>
            <button style={s.addBtn} onClick={() => setShowAdd(true)}>
              <span>+</span> Create First Orbit
            </button>
          </div>
        ) : (
          <div style={s.grid}>
            {usecases.map(uc => (
              <div
                key={uc.id}
                style={s.card}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6c63ff66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a2e'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {/* Subtle gradient top accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #6c63ff, #9b59b6)', borderRadius: '20px 20px 0 0' }} />

                <div style={s.cardIcon}>{uc.icon}</div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={s.cardName}>{uc.name}</span>
                  {uc.notify_email && (
                    <span style={s.reminderBadge} title={`Reminder: ${uc.notify_time} to ${uc.notify_email}`}>
                      🔔 {uc.notify_time?.slice(0, 5)}
                    </span>
                  )}
                </div>
                <div style={s.cardDesc}>{uc.description || 'Daily check-in tracking'}</div>

                <div style={s.cardFooter}>
                  <span style={s.badge}>
                    {todayStats[uc.id] ? `✓ ${todayStats[uc.id]} checked today` : '○ Not checked today'}
                  </span>
                  <div style={s.actions}>
                    <button
                      style={{ ...s.copyBtn, ...(copiedId === uc.id ? { background: '#1a3a1a', borderColor: '#3d6a3d', color: '#7dba7d' } : {}) }}
                      onClick={(e) => copyOrbitLink(uc.id, e)}
                      onMouseEnter={e => { if (copiedId !== uc.id) e.target.style.color = '#6c63ff' }}
                      onMouseLeave={e => { if (copiedId !== uc.id) e.target.style.color = '#4a4870' }}
                      title="Copy check-in link"
                    >
                      {copiedId === uc.id ? '✓ Copied!' : '🔗'}
                    </button>
                    <button
                      style={s.actionBtn}
                      onClick={(e) => { e.stopPropagation(); navigate(`/usecase/${uc.id}/stats`) }}
                      onMouseEnter={e => e.target.style.color = '#6c63ff'}
                      onMouseLeave={e => e.target.style.color = '#4a4870'}
                    >
                      Stats
                    </button>
                    <button
                      style={{ ...s.actionBtn, background: '#6c63ff', color: '#fff', border: 'none' }}
                      onClick={() => navigate(`/usecase/${uc.id}`)}
                    >
                      Check In →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddUsecase
          onClose={() => setShowAdd(false)}
          onCreated={(uc) => { setUsecases(prev => [...prev, uc]); setShowAdd(false) }}
          userId={user.id}
          icons={ICONS}
        />
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
    </div>
  )
}
