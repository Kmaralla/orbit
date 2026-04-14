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
import OrbitChat from '../components/OrbitChat'
import CloseOrbit from '../components/CloseOrbit'
import ShareOrbit from '../components/ShareOrbit'
import SideQuestPanel from '../components/SideQuestPanel'
import Organize from '../components/Organize'
import ActivityStrip from '../components/ActivityStrip'
import { playCheckSound, playLogSound } from '../lib/sounds'

const ICONS = ['👴', '👧', '💼', '🧘', '💪', '📚', '❤️', '🎯', '🌱', '🏠', '✈️', '🎨']

// Always use local date — toISOString() returns UTC which breaks for EST/IST users late at night
const getLocalToday = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]

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
  const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [reminderTime, setReminderTime] = useState('08:00')
  const [todayPlan, setTodayPlan] = useState(null)
  const [planEntries, setPlanEntries] = useState({})
  const [planSaving, setPlanSaving] = useState({})
  const [planAllDone, setPlanAllDone] = useState(false)
  const [closingOrbit, setClosingOrbit] = useState(null) // orbit object to close
  const [showClosedOrbits, setShowClosedOrbits] = useState(false)
  const [sharingOrbit, setSharingOrbit] = useState(null) // orbit object to share
  const [showOrganize, setShowOrganize] = useState(false)
  const [activityEntries, setActivityEntries] = useState([])
  const [activityTotalItems, setActivityTotalItems] = useState(0)

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

    // Load stored timezone and reminder time from first orbit that has them
    const firstWithSettings = (data || []).find(uc => uc.timezone || uc.notify_time)
    if (firstWithSettings?.timezone) setUserTimezone(firstWithSettings.timezone)
    if (firstWithSettings?.notify_time) setReminderTime(firstWithSettings.notify_time.slice(0, 5))

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

    // Store entries + item count for ActivityStrip
    setActivityEntries(allEntries || [])
    setActivityTotalItems(items?.length || 0)

    // Calculate today's counts
    const today = getLocalToday()
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

    // Re-validate today's plan against current orbits (clears stale deleted-orbit tasks)
    loadTodayPlan(data || [])
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
      await supabase
        .from('usecases')
        .update({ notify_email: userEmail, notify_time: reminderTime, timezone: userTimezone })
        .eq('user_id', user.id)
      setUsecases(prev => prev.map(uc => ({ ...uc, notify_email: userEmail, notify_time: reminderTime, timezone: userTimezone })))
      setRemindersEnabled(true)
    }
    setTogglingReminder(false)
  }

  const loadTodayPlan = (activeUsecases) => {
    if (!user?.id) return
    const today = getLocalToday()
    try {
      const raw = localStorage.getItem(`orbit_today_plan_${user.id}`)
      if (!raw) return
      const stored = JSON.parse(raw)
      if (stored.date !== today) { localStorage.removeItem(`orbit_today_plan_${user.id}`); return }

      // Filter out any orbits that no longer exist (deleted after plan was created)
      const activeIds = new Set((activeUsecases || usecases).map(u => u.id))
      if (stored.plan) {
        stored.plan = stored.plan.filter(p => activeIds.has(p.orbitId))
      }
      if (stored.planItems) {
        Object.keys(stored.planItems).forEach(k => { if (!activeIds.has(k)) delete stored.planItems[k] })
      }
      // If the plan is now empty after filtering, clear it
      if (!stored.plan?.length) { localStorage.removeItem(`orbit_today_plan_${user.id}`); return }

      setTodayPlan(stored)
      setPlanEntries(stored.entries || {})
      // Check if already all done
      const allIds = Object.values(stored.planItems || {}).flat().map(i => i.id)
      const done = allIds.every(id => { const v = (stored.entries || {})[id]; return v && v !== '' && v !== 'false' })
      if (allIds.length > 0 && done) setPlanAllDone(true)
    } catch {}
  }

  useEffect(() => { loadTodayPlan() }, [user])

  const savePlanEntry = async (itemId, value, valueType) => {
    setPlanSaving(prev => ({ ...prev, [itemId]: true }))
    const today = getLocalToday()
    await supabase.from('checkin_entries').upsert({
      checklist_item_id: itemId,
      user_id: user.id,
      date: today,
      value: String(value),
    }, { onConflict: 'checklist_item_id,user_id,date' })

    const newEntries = { ...planEntries, [itemId]: String(value) }
    setPlanEntries(newEntries)
    setPlanSaving(prev => ({ ...prev, [itemId]: false }))

    // Persist entries to localStorage
    try {
      const raw = localStorage.getItem(`orbit_today_plan_${user.id}`)
      if (raw) {
        const stored = JSON.parse(raw)
        stored.entries = newEntries
        localStorage.setItem(`orbit_today_plan_${user.id}`, JSON.stringify(stored))
      }
    } catch {}

    // Sound
    valueType === 'checkbox' ? playCheckSound() : playLogSound()

    // Check all done
    const allIds = Object.values(todayPlan?.planItems || {}).flat().map(i => i.id)
    const doneCount = allIds.filter(id => {
      const v = id === itemId ? String(value) : newEntries[id]
      return v && v !== '' && v !== 'false'
    }).length
    if (doneCount === allIds.length && allIds.length > 0) {
      setTimeout(() => setPlanAllDone(true), 500)
    }
  }

  const dismissPlan = () => {
    try { localStorage.removeItem(`orbit_today_plan_${user.id}`) } catch {}
    setTodayPlan(null)
    setPlanEntries({})
    setPlanAllDone(false)
  }

  const saveTimezoneSettings = async (newTimezone, newTime) => {
    const tz = newTimezone ?? userTimezone
    const time = newTime ?? reminderTime
    if (newTimezone) setUserTimezone(newTimezone)
    if (newTime) setReminderTime(newTime)
    // Always persist timezone; only update notify_time if reminders are enabled
    const update = remindersEnabled
      ? { timezone: tz, notify_time: time }
      : { timezone: tz }
    await supabase.from('usecases').update(update).eq('user_id', user.id)
  }

  const deleteUsecase = async (id) => {
    await supabase.from('usecases').delete().eq('id', id)
    setUsecases(prev => prev.filter(u => u.id !== id))
    // Re-fetch so topFocus, streaks, and item counts drop the deleted orbit
    fetchUsecases()
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
                ? 'Track habits, hit goals, and stay on top of what matters.'
                : `${usecases.length} orbit${usecases.length > 1 ? 's' : ''} in motion · habits, goals, tasks — all tracked`}
            </p>
          </div>
        </div>

        {/* Activity strip — only when user has orbits */}
        {!loading && usecases.length > 0 && (
          <ActivityStrip entries={activityEntries} totalItems={activityTotalItems} />
        )}

        {/* Merged action section */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
            {[
              {
                icon: '✨',
                title: 'Build with AI',
                desc: 'Describe a goal — AI designs your orbit',
                accent: true,
                action: () => setShowBuildHabit(true),
              },
              {
                icon: '＋',
                title: 'New Orbit',
                desc: 'Manually set up daily habit tracking',
                action: () => setShowAdd(true),
              },
              {
                icon: '☄️',
                title: 'Side Quests',
                desc: 'One-time tasks, not daily habits',
                action: () => window.dispatchEvent(new CustomEvent('openSideQuests')),
              },
              ...(usecases.length >= 2 ? [{
                icon: '🗓️',
                title: todayPlan ? 'Replan My Day' : 'Plan My Day',
                desc: 'Pick today\'s priorities across orbits',
                action: () => setShowBuildDay(true),
              }] : []),
              ...(usecases.length >= 2 ? [{
                icon: '🧹',
                title: 'Organize',
                desc: 'AI reviews your habits and suggests cleanups',
                action: () => setShowOrganize(true),
              }] : []),
            ].map(({ icon, title, desc, accent, action }) => (
              <button
                key={title}
                onClick={action}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 6,
                  background: accent ? `linear-gradient(135deg, ${colors.accent}22, ${colors.accent}0a)` : colors.bgCard,
                  border: `1px solid ${accent ? colors.accent + '66' : colors.border}`,
                  borderRadius: 14,
                  padding: isMobile ? '12px 12px' : '14px 16px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent + '99'; e.currentTarget.style.background = colors.accent + '18' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = accent ? colors.accent + '66' : colors.border; e.currentTarget.style.background = accent ? `linear-gradient(135deg, ${colors.accent}22, ${colors.accent}0a)` : colors.bgCard }}
              >
                <span style={{ fontSize: isMobile ? 20 : 22 }}>{icon}</span>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: isMobile ? 12 : 13, fontWeight: 800, color: accent ? colors.accent : colors.text }}>
                  {title}
                </div>
                {!isMobile && (
                  <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.4 }}>{desc}</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Top Focus Section - show fewer on mobile */}
        {!loading && topFocus.length > 0 && (
          <div style={s.focusSection}>
            <div style={s.focusTitle}>
              <span>🎯</span> Today's Focus
              <button
                style={{ marginLeft: 'auto', background: `linear-gradient(135deg, ${colors.accent}22, ${colors.accent}44)`, border: `1.5px solid ${colors.accent}88`, borderRadius: 10, padding: '5px 14px', fontSize: 12, color: colors.accent, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.2px', boxShadow: `0 0 10px ${colors.accent}22` }}
                onClick={() => navigate('/analytics')}
                onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${colors.accent}44, ${colors.accent}66)`; e.currentTarget.style.boxShadow = `0 0 16px ${colors.accent}44` }}
                onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${colors.accent}22, ${colors.accent}44)`; e.currentTarget.style.boxShadow = `0 0 10px ${colors.accent}22` }}
              >
                <span style={{ fontSize: 14 }}>📊</span> Overall Stats
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

        {/* ── Today's Priorities ───────────────────────────────────── */}
        {todayPlan && !loading && (
          <div style={{ marginBottom: 28 }}>
            {planAllDone ? (
              // All done celebration
              <div style={{ background: 'linear-gradient(135deg, #22c55e18, #22c55e08)', border: '1.5px solid #22c55e44', borderRadius: 20, padding: '24px 28px', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 20, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>Day Complete!</div>
                <div style={{ fontSize: 14, color: colors.textDim, marginBottom: 16 }}>All today's priorities done. Streaks building. Keep the momentum.</div>
                <button onClick={dismissPlan} style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 16px', color: colors.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Dismiss</button>
              </div>
            ) : (() => {
              const allPlanIds = Object.values(todayPlan.planItems || {}).flat().map(i => i.id)
              const doneCount = allPlanIds.filter(id => { const v = planEntries[id]; return v && v !== '' && v !== 'false' }).length
              const progress = allPlanIds.length > 0 ? Math.round((doneCount / allPlanIds.length) * 100) : 0
              const PCOLS = { high: { bg: '#22c55e18', border: '#22c55e44', label: '#22c55e' }, medium: { bg: '#6c63ff18', border: '#6c63ff44', label: '#6c63ff' }, low: { bg: '#ffffff08', border: '#ffffff18', label: '#8a86a0' } }

              return (
                <div style={{ background: colors.bgCard, border: `1.5px solid ${colors.accent}55`, borderRadius: 20, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🎯</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 16, fontWeight: 800, color: colors.text }}>Today's Priorities</div>
                      <div style={{ fontSize: 12, color: colors.accent, marginTop: 1 }}>{todayPlan.summary}</div>
                    </div>
                    <div style={{ fontSize: 12, color: colors.textDim, marginRight: 4 }}>{doneCount}/{allPlanIds.length} done</div>
                    <button onClick={dismissPlan} style={{ background: 'none', border: 'none', color: colors.textDim, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 4 }} title="Dismiss plan">✕</button>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 3, background: colors.border }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#22c55e' : colors.accentGradient, transition: 'width 0.4s ease' }} />
                  </div>

                  {/* Orbit sections */}
                  <div style={{ padding: '12px 20px 16px' }}>
                    {(todayPlan.plan || []).map(planOrbit => {
                      const pc = PCOLS[planOrbit.priority] || PCOLS.medium
                      const items = (todayPlan.planItems || {})[planOrbit.orbitId] || []
                      const orbitDone = items.length > 0 && items.every(item => { const v = planEntries[item.id]; return v && v !== '' && v !== 'false' })

                      return (
                        <div key={planOrbit.orbitId} style={{ marginBottom: 12, background: orbitDone ? '#22c55e0a' : pc.bg, border: `1.5px solid ${orbitDone ? '#22c55e33' : pc.border}`, borderRadius: 14, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 18 }}>{planOrbit.orbitIcon}</span>
                            <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: colors.text, flex: 1 }}>{planOrbit.orbitName}</span>
                            {orbitDone
                              ? <span style={{ fontSize: 11, fontWeight: 700, background: '#22c55e22', color: '#22c55e', padding: '2px 8px', borderRadius: 10 }}>✓ Done</span>
                              : planOrbit.priority === 'high' && <span style={{ fontSize: 11, fontWeight: 700, background: pc.label + '22', color: pc.label, padding: '2px 8px', borderRadius: 10 }}>Must Do</span>
                            }
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {items.map(item => {
                              const val = planEntries[item.id]
                              const done = val && val !== '' && val !== 'false'
                              return (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {/* Checkbox */}
                                  {item.value_type === 'checkbox' && (
                                    <button
                                      onClick={() => savePlanEntry(item.id, !done, 'checkbox')}
                                      style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${done ? '#22c55e' : pc.label}`, background: done ? '#22c55e' : 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
                                    >{done ? '✓' : ''}</button>
                                  )}
                                  {/* Score */}
                                  {item.value_type === 'score' && (
                                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                        <button key={n} onClick={() => savePlanEntry(item.id, n, 'score')} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${Number(val) === n ? pc.label : colors.border}`, background: Number(val) === n ? pc.label : 'transparent', color: Number(val) === n ? '#fff' : colors.textDim, fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                                      ))}
                                    </div>
                                  )}
                                  {/* Number */}
                                  {item.value_type === 'number' && (
                                    <input type="number" placeholder="0" defaultValue={val || ''} key={item.id + (val ?? '')}
                                      style={{ width: 56, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 7, padding: '4px 8px', color: colors.text, fontSize: 12, outline: 'none', textAlign: 'center', flexShrink: 0 }}
                                      onBlur={e => { if (e.target.value) savePlanEntry(item.id, e.target.value, 'number') }}
                                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                    />
                                  )}
                                  <span style={{ fontSize: 13, color: done ? colors.textDim : colors.text, textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{item.label}</span>
                                  {planSaving[item.id] && <span style={{ fontSize: 10, color: colors.accent }}>•••</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    {todayPlan.greeting && (
                      <div style={{ fontSize: 12, color: colors.textDim, fontStyle: 'italic', marginTop: 4, paddingTop: 8, borderTop: `1px solid ${colors.border}` }}>
                        "{todayPlan.greeting}"
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
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
                <span style={{ fontSize: 18 }}>⚙️</span>
                <div>
                  <div style={{ ...s.toggleLabel, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    Settings
                    <span style={{ fontSize: 11, color: colors.textDim, fontWeight: 500 }}>
                      (Reminders · Push · Timezone)
                    </span>
                  </div>
                  <div style={s.toggleSub}>
                    {pushEnabled && remindersEnabled
                      ? `Push & email at ${reminderTime}`
                      : pushEnabled
                        ? `Push at ${reminderTime}`
                        : remindersEnabled
                          ? `Email at ${reminderTime}`
                          : 'Tap to configure'}
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
                          ? `Daily reminder at ${reminderTime}`
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

                {/* Timezone + Time settings */}
                <div style={{ width: '100%', background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: colors.textDim, flexShrink: 0 }}>🕐 Reminder time</span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={e => saveTimezoneSettings(undefined, e.target.value)}
                    style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, padding: '4px 10px', fontSize: 13, fontFamily: 'Nunito, sans-serif', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: colors.textDim, flexShrink: 0 }}>🌍 Timezone</span>
                  <select
                    value={userTimezone}
                    onChange={e => saveTimezoneSettings(e.target.value, undefined)}
                    style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, padding: '4px 10px', fontSize: 13, fontFamily: 'Nunito, sans-serif', cursor: 'pointer', flex: 1, minWidth: 180 }}
                  >
                    {[
                      ['Asia/Kolkata', 'India (IST, UTC+5:30)'],
                      ['Asia/Dubai', 'Dubai (GST, UTC+4)'],
                      ['Asia/Singapore', 'Singapore (SGT, UTC+8)'],
                      ['Asia/Tokyo', 'Tokyo (JST, UTC+9)'],
                      ['Asia/Dhaka', 'Dhaka (BST, UTC+6)'],
                      ['Asia/Karachi', 'Karachi (PKT, UTC+5)'],
                      ['Asia/Colombo', 'Sri Lanka (SLST, UTC+5:30)'],
                      ['Europe/London', 'London (GMT/BST)'],
                      ['Europe/Paris', 'Paris (CET, UTC+1/2)'],
                      ['Europe/Berlin', 'Berlin (CET, UTC+1/2)'],
                      ['America/New_York', 'New York (ET, UTC-5/4)'],
                      ['America/Chicago', 'Chicago (CT, UTC-6/5)'],
                      ['America/Denver', 'Denver (MT, UTC-7/6)'],
                      ['America/Los_Angeles', 'Los Angeles (PT, UTC-8/7)'],
                      ['America/Toronto', 'Toronto (ET, UTC-5/4)'],
                      ['America/Vancouver', 'Vancouver (PT, UTC-8/7)'],
                      ['America/Sao_Paulo', 'São Paulo (BRT, UTC-3)'],
                      ['Australia/Sydney', 'Sydney (AEDT, UTC+11/10)'],
                      ['Australia/Melbourne', 'Melbourne (AEDT, UTC+11/10)'],
                      ['Pacific/Auckland', 'Auckland (NZST, UTC+12/13)'],
                    ].map(([tz, label]) => (
                      <option key={tz} value={tz}>{label}</option>
                    ))}
                    {/* Show current timezone if not in list */}
                    {![
                      'Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Asia/Dhaka','Asia/Karachi','Asia/Colombo',
                      'Europe/London','Europe/Paris','Europe/Berlin',
                      'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto','America/Vancouver','America/Sao_Paulo',
                      'Australia/Sydney','Australia/Melbourne','Pacific/Auckland'
                    ].includes(userTimezone) && (
                      <option value={userTimezone}>{userTimezone}</option>
                    )}
                  </select>
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
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 0 40px' }}>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 800, color: colors.text, marginBottom: 6 }}>
              What are you here to track? 🎯
            </div>
            <p style={{ fontSize: 14, color: colors.textDim, lineHeight: 1.7, marginBottom: 28 }}>
              Orbit keeps you consistent — on daily habits, life goals, or just things you need to get done. Here's how to start:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Path 1 — AI-built orbit */}
              <button
                onClick={() => setShowBuildHabit(true)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, background: `linear-gradient(135deg, ${colors.accent}18, ${colors.accent}08)`, border: `1.5px solid ${colors.accent}55`, borderRadius: 16, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = colors.accent + '55'}
              >
                <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>🤖</span>
                <div>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 15, fontWeight: 800, color: colors.accent, marginBottom: 4 }}>
                    Tell me your goal — I'll design the orbit
                  </div>
                  <div style={{ fontSize: 13, color: colors.textDim, lineHeight: 1.6 }}>
                    Want to <em style={{ color: colors.textMuted }}>sleep better, exercise more, be more present with your kids</em>? Describe it and Orbit AI builds the daily tracking system for you.
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: colors.accent, fontWeight: 700 }}>Ask AI to build my orbit →</div>
                </div>
              </button>

              {/* Path 2 — Manual orbit */}
              <button
                onClick={() => setShowAdd(true)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, background: colors.bgCard, border: `1.5px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent + '66'}
                onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
              >
                <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>＋</span>
                <div>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 15, fontWeight: 800, color: colors.text, marginBottom: 4 }}>
                    I know what I want to track
                  </div>
                  <div style={{ fontSize: 13, color: colors.textDim, lineHeight: 1.6 }}>
                    Create an orbit yourself — name it, pick your check-in items, and start building streaks. Great for things like <em style={{ color: colors.textMuted }}>Dad's health, kids' routine, or career goals</em>.
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>Create orbit manually →</div>
                </div>
              </button>

              {/* Path 3 — Side Quests */}
              <button
                onClick={() => {
                  // open the side quest panel by dispatching a custom event
                  window.dispatchEvent(new CustomEvent('openSideQuests'))
                }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, background: colors.bgCard, border: `1.5px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent + '66'}
                onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
              >
                <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>☄️</span>
                <div>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 15, fontWeight: 800, color: colors.text, marginBottom: 4 }}>
                    Just have a one-time task to get done?
                  </div>
                  <div style={{ fontSize: 13, color: colors.textDim, lineHeight: 1.6 }}>
                    Not a habit — just something to tick off. Like <em style={{ color: colors.textMuted }}>"search for a new house", "fix smoke alarm battery"</em>, or <em style={{ color: colors.textMuted }}>"call the insurance company"</em>. Use Side Quests.
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>Open Side Quests →</div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
          {todayPlan && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: colors.border }} />
              <span style={{ fontSize: 12, color: colors.textDim, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}>All Orbits</span>
              <div style={{ flex: 1, height: 1, background: colors.border }} />
            </div>
          )}
          <div style={s.grid}>
            {usecases.filter(uc => !uc.closed_at).map(uc => {
              const today = getLocalToday()
              const isExpired = uc.end_date && uc.end_date < today
              const daysLeft = uc.end_date && !isExpired
                ? Math.ceil((new Date(uc.end_date) - new Date(today)) / (1000 * 60 * 60 * 24))
                : null
              return (
              <div
                key={uc.id}
                style={{ ...s.card, borderColor: isExpired ? '#f59e0b66' : colors.border }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = isExpired ? '#f59e0b' : colors.accent + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isExpired ? '#f59e0b66' : colors.border; e.currentTarget.style.transform = 'translateY(0)' }}
              >
              {/* Expired banner */}
              {isExpired && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'linear-gradient(90deg,#f59e0b22,#f59e0b11)', borderRadius: '20px 20px 0 0', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>🏁 Goal date reached</span>
                  <button
                    onClick={e => { e.stopPropagation(); setClosingOrbit(uc) }}
                    style={{ background: '#f59e0b22', border: '1px solid #f59e0b66', borderRadius: 6, padding: '3px 10px', color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
                  >
                    Close or extend →
                  </button>
                </div>
              )}
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
                  {daysLeft !== null && (
                    <span style={{ ...s.reminderBadge, background: daysLeft <= 3 ? '#f59e0b22' : colors.border, color: daysLeft <= 3 ? '#f59e0b' : colors.textDim }} title={`Goal ends ${uc.end_date}`}>
                      🏁 {daysLeft}d left
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
                    style={s.actionBtnSmall}
                    onClick={(e) => { e.stopPropagation(); setSharingOrbit(uc) }}
                    onMouseEnter={e => { e.currentTarget.style.background = colors.borderLight; e.currentTarget.style.color = colors.text }}
                    onMouseLeave={e => { e.currentTarget.style.background = colors.border; e.currentTarget.style.color = colors.textMuted }}
                  >
                    <span>🔗</span> Share
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
            )})}
          </div>

          {/* Completed Orbits section */}
          {usecases.filter(uc => uc.closed_at).length > 0 && (
            <div style={{ marginTop: 32 }}>
              <button
                onClick={() => setShowClosedOrbits(!showClosedOrbits)}
                style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 16px', color: colors.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showClosedOrbits ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
                Completed Orbits ({usecases.filter(uc => uc.closed_at).length})
              </button>
              {showClosedOrbits && (
                <div style={{ ...s.grid, marginTop: 12, opacity: 0.75 }}>
                  {usecases.filter(uc => uc.closed_at).map(uc => (
                    <div key={uc.id} style={{ ...s.card, borderColor: uc.goal_achieved ? '#22c55e44' : colors.border, cursor: 'default' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: uc.goal_achieved ? '#22c55e' : colors.border, borderRadius: '20px 20px 0 0' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 28 }}>{uc.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 16, fontWeight: 700, color: colors.textMuted }}>{uc.name}</div>
                          <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>
                            {uc.goal_achieved ? '🏆 Goal achieved' : '🌱 Closed'} · {new Date(uc.closed_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${uc.name}" permanently? This removes all check-in history too.`)) return
                            await supabase.from('usecases').delete().eq('id', uc.id)
                            setUsecases(prev => prev.filter(u => u.id !== uc.id))
                          }}
                          style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '5px 10px', color: colors.textDim, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textDim }}
                          title="Permanently delete this orbit"
                        >
                          Delete
                        </button>
                      </div>
                      {uc.description && <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8 }}>{uc.description}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </>
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
          onDeleted={() => {
            setEditingOrbit(null)
            fetchUsecases()
          }}
          onRequestClose={() => {
            const orbit = editingOrbit
            setEditingOrbit(null)
            setClosingOrbit(orbit)
          }}
        />
      )}

      {closingOrbit && (
        <CloseOrbit
          orbit={closingOrbit}
          userId={user.id}
          onClosed={(orbitId, achieved) => {
            setUsecases(prev => prev.map(uc => uc.id === orbitId
              ? { ...uc, closed_at: new Date().toISOString(), goal_achieved: achieved }
              : uc
            ))
            setClosingOrbit(null)
          }}
          onExtend={(orbitId, newDate) => {
            setUsecases(prev => prev.map(uc => uc.id === orbitId ? { ...uc, end_date: newDate } : uc))
            setClosingOrbit(null)
          }}
          onCancel={() => setClosingOrbit(null)}
        />
      )}

      {showOrganize && (
        <Organize
          orbits={usecases}
          userId={user.id}
          onClose={() => setShowOrganize(false)}
        />
      )}

      {sharingOrbit && (
        <ShareOrbit
          orbit={sharingOrbit}
          userId={user.id}
          onClose={() => setSharingOrbit(null)}
        />
      )}

      {showBuildDay && (
        <BuildDay
          orbits={usecases.filter(uc => !uc.closed_at)}
          userId={user.id}
          onClose={() => { setShowBuildDay(false); loadTodayPlan() }}
          onPlanSaved={loadTodayPlan}
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

      <SideQuestPanel />
      <OrbitChat orbits={usecases} stats={orbitStreaks} />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
