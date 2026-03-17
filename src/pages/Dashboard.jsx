import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { usePushNotifications } from '../hooks/usePushNotifications'
import Navbar from '../components/Navbar'
import AddUsecase from '../components/AddUsecase'

const ICONS = ['👴', '👧', '💼', '🧘', '💪', '📚', '❤️', '🎯', '🌱', '🏠', '✈️', '🎨']

export default function Dashboard() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const navigate = useNavigate()
  const [usecases, setUsecases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [todayStats, setTodayStats] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [togglingReminder, setTogglingReminder] = useState(false)

  const userEmail = user?.email || ''
  const { isSupported: pushSupported, isSubscribed: pushEnabled, subscribe: subscribePush, unsubscribe: unsubscribePush, loading: pushLoading } = usePushNotifications(user?.id)

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

    // Check if any orbit has reminders enabled
    const hasReminders = (data || []).some(uc => uc.notify_email)
    setRemindersEnabled(hasReminders)

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

  const toggleReminders = async () => {
    setTogglingReminder(true)
    if (remindersEnabled) {
      // Disable: clear notify_email from all orbits
      await supabase
        .from('usecases')
        .update({ notify_email: null, notify_time: null })
        .eq('user_id', user.id)
      setUsecases(prev => prev.map(uc => ({ ...uc, notify_email: null, notify_time: null })))
      setRemindersEnabled(false)
    } else {
      // Enable: set user's email on all orbits
      await supabase
        .from('usecases')
        .update({ notify_email: userEmail, notify_time: '08:00' })
        .eq('user_id', user.id)
      setUsecases(prev => prev.map(uc => ({ ...uc, notify_email: userEmail, notify_time: '08:00' })))
      setRemindersEnabled(true)
    }
    setTogglingReminder(false)
  }

  const deleteUsecase = async (id) => {
    await supabase.from('usecases').delete().eq('id', id)
    setUsecases(prev => prev.filter(u => u.id !== id))
  }

  const s = {
    page: { minHeight: '100vh', background: colors.bg },
    content: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 },
    greeting: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 36,
      fontWeight: 700,
      color: colors.text,
      letterSpacing: '-1px',
    },
    greetingSub: { fontSize: 15, color: colors.textDim, marginTop: 6 },
    addBtn: {
      background: colors.accentGradient,
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
      fontFamily: 'Nunito, sans-serif',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: 20,
    },
    card: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 20,
      padding: '28px',
      cursor: 'pointer',
      transition: 'border-color 0.2s, transform 0.2s',
      position: 'relative',
      overflow: 'hidden',
    },
    cardIcon: { fontSize: 40, marginBottom: 16 },
    cardName: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 20,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 6,
    },
    cardDesc: { fontSize: 13, color: colors.textDim, lineHeight: 1.5, marginBottom: 20 },
    cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    badge: {
      background: colors.accent + '22',
      border: `1px solid ${colors.accent}44`,
      borderRadius: 8,
      padding: '5px 12px',
      fontSize: 12,
      color: colors.accent,
    },
    actions: { display: 'flex', gap: 8 },
    actionBtn: {
      background: colors.border,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 8,
      padding: '6px 14px',
      fontSize: 12,
      cursor: 'pointer',
      color: colors.textMuted,
      fontFamily: 'Nunito, sans-serif',
      transition: 'all 0.15s',
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
      background: colors.border,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 12,
      cursor: 'pointer',
      color: colors.textMuted,
      fontFamily: 'Nunito, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      transition: 'all 0.15s',
    },
    emptyState: {
      textAlign: 'center',
      padding: '80px 20px',
      color: colors.textDim,
    },
    emptyIcon: { fontSize: 64, marginBottom: 16, display: 'block' },
    emptyTitle: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 24,
      color: colors.textMuted,
      marginBottom: 8,
    },
    emptyText: { fontSize: 15, color: colors.textDim, marginBottom: 24 },
    reminderToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '12px 16px',
      marginBottom: 24,
    },
    toggleSwitch: {
      width: 44,
      height: 24,
      borderRadius: 12,
      background: colors.border,
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 0.2s',
    },
    toggleKnob: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: colors.textDim,
      position: 'absolute',
      top: 3,
      left: 3,
      transition: 'all 0.2s',
    },
    toggleLabel: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    toggleSub: {
      fontSize: 12,
      color: colors.textDim,
    },
    checkinNudge: {
      background: `linear-gradient(135deg, ${colors.accent}22 0%, ${colors.accent}11 100%)`,
      border: `1px solid ${colors.accent}44`,
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      animation: 'fadeIn 0.5s ease',
    },
    nudgeIcon: {
      fontSize: 32,
      flexShrink: 0,
    },
    nudgeContent: {
      flex: 1,
    },
    nudgeTitle: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 16,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 4,
    },
    nudgeText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    nudgeBtn: {
      background: colors.accent,
      border: 'none',
      borderRadius: 10,
      padding: '10px 20px',
      color: '#fff',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
      whiteSpace: 'nowrap',
    },
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  // Find orbits not checked in today
  const uncheckedOrbits = usecases.filter(uc => !todayStats[uc.id])
  const hasUnchecked = uncheckedOrbits.length > 0 && usecases.length > 0

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

        {/* Check-in Nudge Banner */}
        {!loading && hasUnchecked && (
          <div style={s.checkinNudge}>
            <span style={s.nudgeIcon}>✨</span>
            <div style={s.nudgeContent}>
              <div style={s.nudgeTitle}>
                {uncheckedOrbits.length === 1
                  ? `Time to check in on ${uncheckedOrbits[0].name}!`
                  : `${uncheckedOrbits.length} orbits waiting for today's check-in`}
              </div>
              <div style={s.nudgeText}>
                {uncheckedOrbits.length === 1
                  ? 'Quick 30-second check-in to keep your streak going'
                  : `${uncheckedOrbits.map(o => o.icon).join(' ')} — takes less than a minute`}
              </div>
            </div>
            <button
              style={s.nudgeBtn}
              onClick={() => navigate(`/usecase/${uncheckedOrbits[0].id}`)}
            >
              Check In Now →
            </button>
          </div>
        )}

        {/* Reminder Toggles */}
        {usecases.length > 0 && !loading && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {/* Push Notifications Toggle */}
            {pushSupported && (
              <div style={{ ...s.reminderToggle, flex: 1, minWidth: 280, marginBottom: 0 }}>
                <div>
                  <div style={s.toggleLabel}>🔔 Push notifications</div>
                  <div style={s.toggleSub}>
                    {pushEnabled ? 'Daily reminder at 8pm' : 'Get notified on this device'}
                  </div>
                </div>
                <div
                  style={{
                    ...s.toggleSwitch,
                    background: pushEnabled ? colors.accent : colors.border,
                    opacity: pushLoading ? 0.6 : 1,
                  }}
                  onClick={!pushLoading ? (pushEnabled ? unsubscribePush : subscribePush) : undefined}
                >
                  <div
                    style={{
                      ...s.toggleKnob,
                      left: pushEnabled ? 23 : 3,
                      background: pushEnabled ? '#fff' : colors.textDim,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Email Reminder Toggle */}
            <div style={{ ...s.reminderToggle, flex: 1, minWidth: 280, marginBottom: 0 }}>
              <div>
                <div style={s.toggleLabel}>📧 Email reminders</div>
                <div style={s.toggleSub}>
                  {remindersEnabled ? `Sending to ${userEmail}` : 'Get emails at 12pm & 8pm'}
                </div>
              </div>
              <div
                style={{
                  ...s.toggleSwitch,
                  background: remindersEnabled ? colors.accent : colors.border,
                  opacity: togglingReminder ? 0.6 : 1,
                }}
                onClick={!togglingReminder ? toggleReminders : undefined}
              >
                <div
                  style={{
                    ...s.toggleKnob,
                    left: remindersEnabled ? 23 : 3,
                    background: remindersEnabled ? '#fff' : colors.textDim,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', gap: 20 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ ...s.card, height: 180, background: colors.bgCard, animation: 'pulse 1.5s ease infinite' }} />
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
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {/* Subtle gradient top accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: colors.accentGradient, borderRadius: '20px 20px 0 0' }} />

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
                      onMouseEnter={e => { if (copiedId !== uc.id) { e.target.style.background = colors.borderLight; e.target.style.borderColor = colors.accent } }}
                      onMouseLeave={e => { if (copiedId !== uc.id) { e.target.style.background = colors.border; e.target.style.borderColor = colors.borderLight } }}
                      title="Copy check-in link"
                    >
                      {copiedId === uc.id ? '✓ Copied!' : '🔗'}
                    </button>
                    <button
                      style={s.actionBtn}
                      onClick={(e) => { e.stopPropagation(); navigate(`/usecase/${uc.id}/stats`) }}
                      onMouseEnter={e => { e.target.style.background = colors.borderLight; e.target.style.color = colors.text; e.target.style.borderColor = colors.accent }}
                      onMouseLeave={e => { e.target.style.background = colors.border; e.target.style.color = colors.textMuted; e.target.style.borderColor = colors.borderLight }}
                    >
                      Progress
                    </button>
                    <button
                      style={{ ...s.actionBtn, background: colors.accent, color: '#fff', border: 'none' }}
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

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
