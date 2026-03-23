import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { calculateStreak, getStreakDisplay, calculatePriority } from '../lib/streaks'
import Navbar from '../components/Navbar'
import AddUsecase from '../components/AddUsecase'
import EditOrbit from '../components/EditOrbit'
import BuildHabit from '../components/BuildHabit'
import BuildDay from '../components/BuildDay'

const ICONS = ['👴', '👧', '💼', '🧘', '💪', '📚', '❤️', '🎯', '🌱', '🏠', '✈️', '🎨']

export default function Dashboard() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const navigate = useNavigate()
  const [usecases, setUsecases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showBuildHabit, setShowBuildHabit] = useState(false)
  const [showBuildDay, setShowBuildDay] = useState(false)
  const [editingOrbit, setEditingOrbit] = useState(null)
  const [todayStats, setTodayStats] = useState({})
  const [orbitStreaks, setOrbitStreaks] = useState({}) // { orbitId: { current, best, atRisk } }
  const [orbitItemCounts, setOrbitItemCounts] = useState({}) // { orbitId: number }
  const [topFocus, setTopFocus] = useState([]) // Top 3 priority items
  const [copiedId, setCopiedId] = useState(null)
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [togglingReminder, setTogglingReminder] = useState(false)
  const [showNotificationSettings, setShowNotificationSettings] = useState(false)

  const userEmail = user?.email || ''
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const { isSupported: pushSupported, isSubscribed: pushEnabled, subscribe: subscribePush, unsubscribe: unsubscribePush, loading: pushLoading, error: pushError } = usePushNotifications(user?.id)

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

    if (!data || data.length === 0) {
      setLoading(false)
      return
    }

    // Fetch all checklist items for user's orbits
    const orbitIds = data.map(uc => uc.id)
    const { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .in('usecase_id', orbitIds)

    // Fetch last 60 days of entries for streak calculation
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const { data: allEntries } = await supabase
      .from('checkin_entries')
      .select('*, checklist_items(usecase_id, frequency)')
      .eq('user_id', user.id)
      .gte('date', sixtyDaysAgo.toISOString().split('T')[0])

    // Calculate today's counts
    const today = new Date().toISOString().split('T')[0]
    const counts = {}
    allEntries?.filter(e => e.date === today).forEach(e => {
      const uid = e.checklist_items?.usecase_id
      if (uid) counts[uid] = (counts[uid] || 0) + 1
    })
    setTodayStats(counts)

    // Calculate streaks per orbit (aggregate best streak across items)
    const streaks = {}
    const itemPriorities = []

    for (const orbit of data) {
      const orbitItems = items?.filter(i => i.usecase_id === orbit.id) || []
      let bestCurrentStreak = 0
      let totalAtRisk = 0

      for (const item of orbitItems) {
        const itemEntries = allEntries
          ?.filter(e => e.checklist_item_id === item.id)
          .map(e => ({ date: e.date, value: e.value })) || []

        const streak = calculateStreak(itemEntries, item.frequency)

        if (streak.current > bestCurrentStreak) {
          bestCurrentStreak = streak.current
        }
        if (streak.atRisk) {
          totalAtRisk++
        }

        // Calculate priority for top 3 focus
        const lastEntry = itemEntries.find(e => e.date === today)
        const priority = calculatePriority(item, streak, lastEntry)
        itemPriorities.push({
          item,
          orbit,
          streak,
          priority,
          lastEntry
        })
      }

      streaks[orbit.id] = {
        current: bestCurrentStreak,
        atRisk: totalAtRisk > 0,
        atRiskCount: totalAtRisk
      }
    }

    setOrbitStreaks(streaks)

    // Count checklist items per orbit
    const itemCounts = {}
    for (const orbit of data) {
      itemCounts[orbit.id] = items?.filter(i => i.usecase_id === orbit.id).length || 0
    }
    setOrbitItemCounts(itemCounts)

    // Get top 3 focus items (not completed today, highest priority)
    const uncompleted = itemPriorities
      .filter(p => !p.lastEntry || p.lastEntry.value === '' || p.lastEntry.value === 'false')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)

    setTopFocus(uncompleted)
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
      // Enable: set user's email on all orbits with their timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone // e.g., "America/New_York"
      await supabase
        .from('usecases')
        .update({ notify_email: userEmail, notify_time: '08:00', timezone: userTimezone })
        .eq('user_id', user.id)
      setUsecases(prev => prev.map(uc => ({ ...uc, notify_email: userEmail, notify_time: '08:00', timezone: userTimezone })))
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
    header: { marginBottom: 20 },
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
    cardFooter: { marginBottom: 16 },
    actionsRow: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    },
    actionBtnSmall: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      background: colors.border,
      border: 'none',
      borderRadius: 8,
      padding: '10px 8px',
      fontSize: 12,
      cursor: 'pointer',
      color: colors.textMuted,
      fontFamily: 'Nunito, sans-serif',
      fontWeight: 500,
      transition: 'all 0.15s',
    },
    checkInBtn: {
      flex: 1.5,
      background: colors.accentGradient,
      border: 'none',
      borderRadius: 8,
      padding: '10px 12px',
      color: '#fff',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
    },
    badge: {
      background: colors.accent + '22',
      border: `1px solid ${colors.accent}44`,
      borderRadius: 8,
      padding: '5px 12px',
      fontSize: 12,
      color: colors.accent,
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
    focusSection: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 24,
    },
    focusTitle: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 16,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    focusItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderBottom: `1px solid ${colors.border}`,
    },
    focusItemLast: {
      borderBottom: 'none',
    },
    focusRank: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: colors.accent,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontWeight: 700,
    },
    focusContent: {
      flex: 1,
    },
    focusLabel: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.text,
    },
    focusOrbit: {
      fontSize: 12,
      color: colors.textDim,
    },
    focusStreak: {
      fontSize: 12,
      fontWeight: 600,
      padding: '4px 8px',
      borderRadius: 6,
    },
    focusBtn: {
      background: colors.accent,
      border: 'none',
      borderRadius: 8,
      padding: '8px 14px',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
    },
    streakBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      marginLeft: 8,
    },
  }

  const HEALTH = {
    green:  { color: '#22c55e', bg: '#22c55e14', label: '● On Track' },
    yellow: { color: '#f59e0b', bg: '#f59e0b14', label: '◐ Keep It Up' },
    red:    { color: '#ef4444', bg: '#ef444414', label: '○ Behind' },
  }

  const getOrbitHealth = (ucId) => {
    if (!orbitItemCounts[ucId]) return null // no items yet
    const checkedToday = !!todayStats[ucId]
    const streak = orbitStreaks[ucId]?.current || 0
    const atRisk = orbitStreaks[ucId]?.atRisk || false
    if (checkedToday && streak >= 3) return 'green'
    if (!checkedToday && streak < 3) return 'red'
    return 'yellow' // checked today w/ low streak, or has streak but not checked yet
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
        </div>

        {/* Action buttons strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          {usecases.length >= 2 && (
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: colors.bgCard,
                border: `1px solid ${colors.accent}`,
                borderRadius: 14, padding: '12px 18px',
                cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 180,
                transition: 'all 0.15s',
              }}
              onClick={() => setShowBuildDay(true)}
              onMouseEnter={e => e.currentTarget.style.background = colors.accent + '18'}
              onMouseLeave={e => e.currentTarget.style.background = colors.bgCard}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>🗓️</span>
              <div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: colors.accent }}>Build My Day</div>
                <div style={{ fontSize: 11, color: colors.textDim, marginTop: 1 }}>Plan today from your existing orbits</div>
              </div>
            </button>
          )}
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: colors.bgCard,
              border: `1px solid ${colors.borderLight}`,
              borderRadius: 14, padding: '12px 18px',
              cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 180,
              transition: 'all 0.15s',
            }}
            onClick={() => setShowBuildHabit(true)}
            onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent + '88'}
            onMouseLeave={e => e.currentTarget.style.borderColor = colors.borderLight}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>✨</span>
            <div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: colors.textMuted }}>Build an Orbit</div>
              <div style={{ fontSize: 11, color: colors.textDim, marginTop: 1 }}>Orbit AI designs a new orbit for you</div>
            </div>
          </button>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: colors.accentGradient,
              border: 'none',
              borderRadius: 14, padding: '12px 18px',
              cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 180,
              transition: 'opacity 0.15s',
            }}
            onClick={() => setShowAdd(true)}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>＋</span>
            <div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff' }}>New Orbit</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Manually track anything</div>
            </div>
          </button>
        </div>

        {/* Top Focus Section - show fewer on mobile */}
        {!loading && topFocus.length > 0 && (
          <div style={s.focusSection}>
            <div style={s.focusTitle}>
              <span>🎯</span> Today's Focus
              <button
                style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: '4px 12px', fontSize: 12, color: colors.textMuted, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 600 }}
                onClick={() => navigate('/analytics')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.borderLight; e.currentTarget.style.color = colors.textMuted }}
              >
                📊 All Progress
              </button>
            </div>
            {topFocus.slice(0, isMobile ? 2 : 3).map((focus, idx, arr) => {
              const streakDisplay = getStreakDisplay(focus.streak)
              return (
                <div
                  key={focus.item.id}
                  style={{
                    ...s.focusItem,
                    ...(idx === arr.length - 1 ? s.focusItemLast : {})
                  }}
                >
                  <div style={s.focusRank}>{idx + 1}</div>
                  <div style={s.focusContent}>
                    <div style={s.focusLabel}>{focus.item.label}</div>
                    <div style={s.focusOrbit}>
                      {focus.orbit.icon} {focus.orbit.name}
                      {focus.streak.atRisk && (
                        <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠️ Streak at risk!</span>
                      )}
                    </div>
                  </div>
                  {focus.streak.current > 0 && (
                    <div style={{
                      ...s.focusStreak,
                      background: streakDisplay.color + '22',
                      color: streakDisplay.color
                    }}>
                      {streakDisplay.emoji} {focus.streak.current} days
                    </div>
                  )}
                  <button
                    style={s.focusBtn}
                    onClick={() => navigate(`/usecase/${focus.orbit.id}`)}
                  >
                    Check In
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Check-in Nudge Banner */}
        {!loading && hasUnchecked && topFocus.length === 0 && (
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

        {/* Collapsible Notification Settings */}
        {usecases.length > 0 && !loading && (
          <div style={{ marginBottom: 24 }}>
            {/* Collapsed header - tap to expand */}
            <div
              style={{
                ...s.reminderToggle,
                cursor: 'pointer',
                marginBottom: showNotificationSettings ? 12 : 0,
              }}
              onClick={() => setShowNotificationSettings(!showNotificationSettings)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>🔔</span>
                <div>
                  <div style={s.toggleLabel}>Notifications</div>
                  <div style={s.toggleSub}>
                    {pushEnabled && remindersEnabled
                      ? 'Push & email enabled'
                      : pushEnabled
                        ? 'Push enabled'
                        : remindersEnabled
                          ? 'Email enabled'
                          : 'Tap to set up reminders'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Status dots */}
                {(pushEnabled || remindersEnabled) && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {pushEnabled && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />}
                    {remindersEnabled && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c63ff' }} />}
                  </div>
                )}
                <span style={{ color: colors.textDim, fontSize: 18, transition: 'transform 0.2s', transform: showNotificationSettings ? 'rotate(180deg)' : 'rotate(0)' }}>
                  ▾
                </span>
              </div>
            </div>

            {/* Expanded toggles */}
            {showNotificationSettings && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {/* Push Notifications Toggle */}
                <div style={{ ...s.reminderToggle, flex: 1, minWidth: 260, marginBottom: 0 }}>
                  <div>
                    <div style={s.toggleLabel}>📱 Push notifications</div>
                    <div style={{ ...s.toggleSub, color: pushError ? '#ff6b6b' : colors.textDim }}>
                      {pushError
                        ? pushError
                        : pushEnabled
                          ? 'Daily reminder at 8pm'
                          : 'Get notified on this device'}
                    </div>
                  </div>
                  <div
                    style={{
                      ...s.toggleSwitch,
                      background: pushEnabled ? colors.accent : colors.border,
                      opacity: pushLoading ? 0.6 : 1,
                      cursor: pushLoading ? 'wait' : 'pointer',
                    }}
                    onClick={(e) => { e.stopPropagation(); !pushLoading && (pushEnabled ? unsubscribePush() : subscribePush()) }}
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

                {/* Email Reminder Toggle */}
                <div style={{ ...s.reminderToggle, flex: 1, minWidth: 260, marginBottom: 0 }}>
                  <div>
                    <div style={s.toggleLabel}>📧 Email reminders</div>
                    <div style={s.toggleSub}>
                      {remindersEnabled ? `Sending to ${userEmail}` : 'Daily digest emails'}
                    </div>
                  </div>
                  <div
                    style={{
                      ...s.toggleSwitch,
                      background: remindersEnabled ? colors.accent : colors.border,
                      opacity: togglingReminder ? 0.6 : 1,
                    }}
                    onClick={(e) => { e.stopPropagation(); !togglingReminder && toggleReminders() }}
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
                {/* Health status bar + label */}
                {(() => {
                  const health = getOrbitHealth(uc.id)
                  const h = health ? HEALTH[health] : null
                  return (
                    <>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                        background: h ? h.color : colors.accentGradient,
                        borderRadius: '20px 20px 0 0',
                        transition: 'background 0.3s',
                      }} />
                      {h && (
                        <div style={{
                          position: 'absolute', top: 12, right: 14,
                          background: h.bg,
                          border: `1px solid ${h.color}44`,
                          borderRadius: 20,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: h.color,
                          letterSpacing: '0.3px',
                        }}>
                          {h.label}
                        </div>
                      )}
                    </>
                  )
                })()}

                <div style={s.cardIcon}>{uc.icon}</div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={s.cardName}>{uc.name}</span>
                  {orbitStreaks[uc.id]?.current > 0 && (
                    <span
                      style={{
                        ...s.streakBadge,
                        background: orbitStreaks[uc.id]?.atRisk ? '#f59e0b22' : '#22c55e22',
                        color: orbitStreaks[uc.id]?.atRisk ? '#f59e0b' : '#22c55e',
                      }}
                    >
                      {orbitStreaks[uc.id]?.atRisk ? '⚠️' : '🔥'} {orbitStreaks[uc.id]?.current} days
                    </span>
                  )}
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
                </div>

                {/* Action buttons - evenly spaced */}
                <div style={s.actionsRow}>
                  <button
                    style={s.actionBtnSmall}
                    onClick={(e) => { e.stopPropagation(); setEditingOrbit(uc) }}
                    onMouseEnter={e => { e.currentTarget.style.background = colors.borderLight; e.currentTarget.style.color = colors.text }}
                    onMouseLeave={e => { e.currentTarget.style.background = colors.border; e.currentTarget.style.color = colors.textMuted }}
                  >
                    <span>⚙️</span> Edit
                  </button>
                  <button
                    style={{ ...s.actionBtnSmall, ...(copiedId === uc.id ? { background: '#1a3a1a', color: '#7dba7d' } : {}) }}
                    onClick={(e) => copyOrbitLink(uc.id, e)}
                    onMouseEnter={e => { if (copiedId !== uc.id) { e.currentTarget.style.background = colors.borderLight; e.currentTarget.style.color = colors.text } }}
                    onMouseLeave={e => { if (copiedId !== uc.id) { e.currentTarget.style.background = colors.border; e.currentTarget.style.color = colors.textMuted } }}
                  >
                    <span>🔗</span> {copiedId === uc.id ? 'Copied!' : 'Link'}
                  </button>
                  <button
                    style={s.actionBtnSmall}
                    onClick={(e) => { e.stopPropagation(); navigate(`/usecase/${uc.id}/stats`) }}
                    onMouseEnter={e => { e.currentTarget.style.background = colors.borderLight; e.currentTarget.style.color = colors.text }}
                    onMouseLeave={e => { e.currentTarget.style.background = colors.border; e.currentTarget.style.color = colors.textMuted }}
                  >
                    <span>📊</span> Stats
                  </button>
                  <button
                    style={s.checkInBtn}
                    onClick={() => navigate(`/usecase/${uc.id}`)}
                  >
                    Check In →
                  </button>
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

      {editingOrbit && (
        <EditOrbit
          orbit={editingOrbit}
          onClose={() => setEditingOrbit(null)}
          onUpdated={(updated) => {
            setUsecases(prev => prev.map(uc => uc.id === updated.id ? updated : uc))
            setEditingOrbit(null)
          }}
          onDeleted={(deletedId) => {
            setUsecases(prev => prev.filter(uc => uc.id !== deletedId))
          }}
        />
      )}

      {showBuildDay && (
        <BuildDay
          orbits={usecases}
          userId={user.id}
          onClose={() => setShowBuildDay(false)}
        />
      )}

      {showBuildHabit && (
        <BuildHabit
          onClose={() => setShowBuildHabit(false)}
          onCreated={(orbit) => {
            setUsecases(prev => [...prev, orbit])
            setShowBuildHabit(false)
            navigate(`/usecase/${orbit.id}`)
          }}
          userId={user.id}
        />
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
