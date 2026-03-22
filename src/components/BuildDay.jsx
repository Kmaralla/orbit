import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import { getBuildDayPlan } from '../lib/claude'
import { calculateStreak } from '../lib/streaks'

const TIME_OPTIONS = [
  { key: 'quick', label: 'Quick', sub: '~15 min', icon: '⚡' },
  { key: 'normal', label: 'Normal', sub: '~30 min', icon: '✓' },
  { key: 'deep', label: 'All In', sub: '60+ min', icon: '🎯' },
]

const ENERGY_OPTIONS = [
  { key: 'low', label: 'Low', sub: 'Just the basics', icon: '🔋' },
  { key: 'medium', label: 'Good', sub: 'Steady & focused', icon: '⚡' },
  { key: 'high', label: 'High', sub: 'On fire today', icon: '🚀' },
]

const PRIORITY_COLORS = {
  high:   { bg: '#22c55e18', border: '#22c55e44', label: '#22c55e', badge: 'Must Do' },
  medium: { bg: '#6c63ff18', border: '#6c63ff44', label: '#6c63ff', badge: 'Do It' },
  low:    { bg: '#ffffff08', border: '#ffffff18', label: '#8a86a0', badge: 'If Time' },
}

export default function BuildDay({ orbits, userId, onClose }) {
  const { colors } = useTheme()
  const navigate = useNavigate()

  // phase: 'questions' | 'building' | 'plan' | 'error'
  const [phase, setPhase] = useState('questions')
  const [answers, setAnswers] = useState({ time: null, energy: null, focusOrbits: [] })
  const [plan, setPlan] = useState(null)

  // Data fetched in background while user answers questions
  const [orbitsWithTasks, setOrbitsWithTasks] = useState(null)

  const today = new Date().toISOString().split('T')[0]
  const todayDayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]

  // Fetch all today's tasks + streak context as soon as modal opens
  useEffect(() => {
    fetchTodayData()
  }, [])

  const isScheduledToday = (frequency) => {
    if (!frequency || frequency === 'daily') return true
    if (frequency === 'weekdays') return ['mon', 'tue', 'wed', 'thu', 'fri'].includes(todayDayOfWeek)
    if (frequency === 'weekly') return todayDayOfWeek === 'mon'
    if (frequency.startsWith('custom:')) {
      const days = frequency.split(':')[1]?.split(',') || []
      return days.includes(todayDayOfWeek)
    }
    return true
  }

  const fetchTodayData = async () => {
    const orbitIds = orbits.map(o => o.id)

    const { data: allItems } = await supabase
      .from('checklist_items')
      .select('*')
      .in('usecase_id', orbitIds)

    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const { data: allEntries } = await supabase
      .from('checkin_entries')
      .select('*, checklist_items(usecase_id)')
      .eq('user_id', userId)
      .gte('date', sixtyDaysAgo.toISOString().split('T')[0])

    const todayEntryIds = new Set(
      (allEntries || []).filter(e => e.date === today).map(e => e.checklist_item_id)
    )

    const enriched = orbits.map(orbit => {
      const orbitItems = (allItems || []).filter(i => i.usecase_id === orbit.id)
      const todayItems = orbitItems.filter(i => isScheduledToday(i.frequency))

      // Streak for this orbit (best across items)
      let bestStreak = 0
      let anyAtRisk = false
      for (const item of orbitItems) {
        const itemEntries = (allEntries || [])
          .filter(e => e.checklist_item_id === item.id)
          .map(e => ({ date: e.date, value: e.value }))
        const streak = calculateStreak(itemEntries, item.frequency)
        if (streak.current > bestStreak) bestStreak = streak.current
        if (streak.atRisk) anyAtRisk = true
      }

      const checkedTodayCount = todayItems.filter(i => todayEntryIds.has(i.id)).length

      return {
        ...orbit,
        tasks: todayItems.map(i => ({
          ...i,
          checkedToday: todayEntryIds.has(i.id),
        })),
        streakDays: bestStreak,
        atRisk: anyAtRisk,
        checkedTodayCount,
      }
    }).filter(o => o.tasks.length > 0) // only orbits with tasks today

    setOrbitsWithTasks(enriched)
  }

  const toggleFocusOrbit = (name) => {
    setAnswers(prev => ({
      ...prev,
      focusOrbits: prev.focusOrbits.includes(name)
        ? prev.focusOrbits.filter(n => n !== name)
        : [...prev.focusOrbits, name],
    }))
  }

  const canBuild = answers.time && answers.energy

  const handleBuild = async () => {
    if (!canBuild) return
    setPhase('building')

    // Wait for data if still loading
    let data = orbitsWithTasks
    if (!data) {
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (orbitsWithTasks !== null) { clearInterval(check); resolve() }
        }, 100)
        setTimeout(() => { clearInterval(check); resolve() }, 8000)
      })
      data = orbitsWithTasks
    }

    if (!data || data.length === 0) {
      setPhase('error')
      return
    }

    const result = await getBuildDayPlan(data, answers)
    if (!result) {
      setPhase('error')
      return
    }
    setPlan(result)
    setPhase('plan')
  }

  const s = {
    overlay: {
      position: 'fixed', inset: 0, background: '#000c',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 60, padding: 20,
    },
    box: {
      background: colors.bgCard,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 24,
      width: '100%',
      maxWidth: 560,
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      padding: '24px 28px 20px',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexShrink: 0,
    },
    title: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 22,
      fontWeight: 800,
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: { fontSize: 13, color: colors.textDim },
    closeBtn: {
      background: 'none', border: 'none', color: colors.textDim,
      cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
    },
    body: {
      padding: '24px 28px',
      overflowY: 'auto',
      flex: 1,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: colors.textDim,
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      marginBottom: 10,
      marginTop: 20,
    },
    optionRow: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
    },
    optionBtn: {
      flex: 1,
      minWidth: 90,
      background: colors.bgInput,
      border: `1.5px solid ${colors.border}`,
      borderRadius: 14,
      padding: '12px 10px',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.15s',
    },
    optionIcon: { fontSize: 22, marginBottom: 4 },
    optionLabel: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 14,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 2,
    },
    optionSub: { fontSize: 11, color: colors.textDim },
    orbitChip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 14px',
      borderRadius: 20,
      border: `1.5px solid ${colors.border}`,
      background: colors.bgInput,
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: 'Nunito, sans-serif',
      fontWeight: 600,
      color: colors.textMuted,
      transition: 'all 0.15s',
    },
    footer: {
      padding: '16px 28px',
      borderTop: `1px solid ${colors.border}`,
      flexShrink: 0,
    },
    buildBtn: {
      width: '100%',
      background: colors.accentGradient,
      border: 'none',
      borderRadius: 14,
      padding: '16px',
      color: '#fff',
      fontSize: 16,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
      transition: 'opacity 0.2s',
    },
    // Plan phase styles
    greeting: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 1.6,
      marginBottom: 6,
      fontStyle: 'italic',
    },
    summary: {
      fontSize: 13,
      color: colors.textDim,
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    orbitCard: {
      borderRadius: 16,
      padding: '16px 18px',
      marginBottom: 12,
      border: '1.5px solid',
      transition: 'all 0.2s',
    },
    orbitCardHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    orbitCardName: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 16,
      fontWeight: 700,
      color: colors.text,
      flex: 1,
    },
    priorityBadge: {
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 20,
      letterSpacing: '0.3px',
    },
    taskList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      marginBottom: 10,
    },
    taskItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: colors.text,
    },
    taskDot: {
      width: 6, height: 6,
      borderRadius: '50%',
      background: colors.accent,
      flexShrink: 0,
    },
    orbitReason: {
      fontSize: 12,
      color: colors.textDim,
      lineHeight: 1.5,
      borderTop: `1px solid ${colors.border}`,
      paddingTop: 8,
      marginBottom: 10,
    },
    checkinBtn: {
      background: colors.accent,
      border: 'none',
      borderRadius: 8,
      padding: '8px 16px',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
    },
    skippedSection: {
      marginTop: 8,
      marginBottom: 16,
    },
    skippedTitle: {
      fontSize: 12,
      fontWeight: 700,
      color: colors.textDim,
      letterSpacing: '0.6px',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    skippedItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: colors.textDim,
      padding: '6px 0',
      borderBottom: `1px solid ${colors.border}`,
    },
  }

  // ── Building phase ──────────────────────────────────────────────
  if (phase === 'building') {
    return (
      <div style={s.overlay}>
        <div style={{ ...s.box, alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20, animation: 'spin 2s linear infinite' }}>✨</div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 20, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Building your day...
          </div>
          <div style={{ fontSize: 14, color: colors.textDim }}>
            Analyzing your orbits and tasks
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // ── Error phase ─────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div style={s.overlay} onClick={onClose}>
        <div style={{ ...s.box, alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>😕</div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Couldn't build your plan
          </div>
          <div style={{ fontSize: 14, color: colors.textDim, marginBottom: 24 }}>
            No tasks are scheduled for today, or the AI timed out. Try again!
          </div>
          <button style={{ ...s.buildBtn, maxWidth: 200 }} onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  // ── Plan phase ──────────────────────────────────────────────────
  if (phase === 'plan' && plan) {
    const topOrbit = plan.plan?.[0]
    return (
      <div style={s.overlay} onClick={onClose}>
        <div style={s.box} onClick={e => e.stopPropagation()}>
          <div style={s.header}>
            <div>
              <div style={s.title}>Today's Plan 🗓️</div>
              <div style={{ ...s.subtitle, color: colors.accent }}>{plan.summary}</div>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div style={s.body}>
            <p style={s.greeting}>"{plan.greeting}"</p>

            {/* Orbit plan cards */}
            {plan.plan?.map((item) => {
              const pc = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium
              return (
                <div
                  key={item.orbitId}
                  style={{ ...s.orbitCard, background: pc.bg, borderColor: pc.border }}
                >
                  <div style={s.orbitCardHeader}>
                    <span style={{ fontSize: 22 }}>{item.orbitIcon}</span>
                    <span style={s.orbitCardName}>{item.orbitName}</span>
                    {item.priority === 'high' && (
                      <span style={{ ...s.priorityBadge, background: pc.label + '22', color: pc.label }}>
                        {pc.badge}
                      </span>
                    )}
                  </div>

                  <div style={s.taskList}>
                    {item.tasks.map((task, i) => (
                      <div key={i} style={s.taskItem}>
                        <div style={{ ...s.taskDot, background: pc.label }} />
                        {task}
                      </div>
                    ))}
                  </div>

                  <div style={s.orbitReason}>{item.reason}</div>

                  <button
                    style={{ ...s.checkinBtn, background: pc.label }}
                    onClick={() => { navigate(`/usecase/${item.orbitId}`); onClose() }}
                  >
                    Check In →
                  </button>
                </div>
              )
            })}

            {/* Skipped orbits */}
            {plan.skipped?.length > 0 && (
              <div style={s.skippedSection}>
                <div style={s.skippedTitle}>Skipping today</div>
                {plan.skipped.map((s_item, i) => (
                  <div key={i} style={s.skippedItem}>
                    <span>{s_item.orbitIcon}</span>
                    <span style={{ fontWeight: 600, color: colors.textMuted }}>{s_item.orbitName}</span>
                    <span style={{ color: colors.textDim }}>— {s_item.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={s.footer}>
            {topOrbit && (
              <button
                style={s.buildBtn}
                onClick={() => { navigate(`/usecase/${topOrbit.orbitId}`); onClose() }}
              >
                Start with {topOrbit.orbitIcon} {topOrbit.orbitName} →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Questions phase ─────────────────────────────────────────────
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <div style={s.title}>Build My Day ✨</div>
            <div style={s.subtitle}>3 quick questions — we'll pick what matters most</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          {/* Q1: Time */}
          <div style={{ ...s.sectionLabel, marginTop: 0 }}>How much time do you have?</div>
          <div style={s.optionRow}>
            {TIME_OPTIONS.map(opt => (
              <button
                key={opt.key}
                style={{
                  ...s.optionBtn,
                  borderColor: answers.time === opt.key ? colors.accent : colors.border,
                  background: answers.time === opt.key ? colors.accent + '18' : colors.bgInput,
                }}
                onClick={() => setAnswers(prev => ({ ...prev, time: opt.key }))}
              >
                <div style={s.optionIcon}>{opt.icon}</div>
                <div style={{ ...s.optionLabel, color: answers.time === opt.key ? colors.accent : colors.text }}>{opt.label}</div>
                <div style={s.optionSub}>{opt.sub}</div>
              </button>
            ))}
          </div>

          {/* Q2: Energy */}
          <div style={s.sectionLabel}>What's your energy today?</div>
          <div style={s.optionRow}>
            {ENERGY_OPTIONS.map(opt => (
              <button
                key={opt.key}
                style={{
                  ...s.optionBtn,
                  borderColor: answers.energy === opt.key ? colors.accent : colors.border,
                  background: answers.energy === opt.key ? colors.accent + '18' : colors.bgInput,
                }}
                onClick={() => setAnswers(prev => ({ ...prev, energy: opt.key }))}
              >
                <div style={s.optionIcon}>{opt.icon}</div>
                <div style={{ ...s.optionLabel, color: answers.energy === opt.key ? colors.accent : colors.text }}>{opt.label}</div>
                <div style={s.optionSub}>{opt.sub}</div>
              </button>
            ))}
          </div>

          {/* Q3: Priority orbits (optional) */}
          <div style={s.sectionLabel}>
            Any orbit to prioritize? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {orbits.map(orbit => {
              const selected = answers.focusOrbits.includes(orbit.name)
              return (
                <button
                  key={orbit.id}
                  style={{
                    ...s.orbitChip,
                    borderColor: selected ? colors.accent : colors.border,
                    background: selected ? colors.accent + '18' : colors.bgInput,
                    color: selected ? colors.accent : colors.textMuted,
                  }}
                  onClick={() => toggleFocusOrbit(orbit.name)}
                >
                  <span>{orbit.icon}</span>
                  {orbit.name}
                </button>
              )
            })}
          </div>

          {/* Hint when data is still loading */}
          {!orbitsWithTasks && (
            <div style={{ fontSize: 12, color: colors.textDim, marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⟳</span>
              Loading your tasks...
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button
            style={{ ...s.buildBtn, opacity: canBuild ? 1 : 0.4, cursor: canBuild ? 'pointer' : 'not-allowed' }}
            onClick={handleBuild}
            disabled={!canBuild}
          >
            {canBuild ? 'Build My Day →' : 'Answer the questions above'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
