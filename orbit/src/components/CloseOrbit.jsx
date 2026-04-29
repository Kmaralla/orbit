import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import { calculateStreak } from '../lib/streaks'

export default function CloseOrbit({ orbit, userId, onClosed, onExtend, onCancel }) {
  const { colors } = useTheme()
  const [phase, setPhase] = useState('loading') // loading | confirm | celebrating | done
  const [goalAchieved, setGoalAchieved] = useState(null)
  const [stats, setStats] = useState(null)
  const [closing, setClosing] = useState(false)
  const [extendDate, setExtendDate] = useState('')
  const [showExtend, setShowExtend] = useState(false)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('usecase_id', orbit.id)

    const itemIds = (items || []).map(i => i.id)

    const createdAt = new Date(orbit.created_at)
    const today = new Date()
    const durationDays = Math.max(1, Math.round((today - createdAt) / (1000 * 60 * 60 * 24)))

    if (!itemIds.length) {
      setStats({ totalEntries: 0, bestStreak: 0, completionPct: 0, durationDays, itemCount: 0 })
      setPhase('confirm')
      return
    }

    const startDate = createdAt.toISOString().split('T')[0]
    const { data: allEntries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, date, value')
      .in('checklist_item_id', itemIds)
      .gte('date', startDate)

    // Best streak across all items
    let bestStreak = 0
    let totalCompleted = 0
    for (const item of items || []) {
      const itemEntries = (allEntries || [])
        .filter(e => e.checklist_item_id === item.id)
        .map(e => ({ date: e.date, value: e.value }))
      const streak = calculateStreak(itemEntries, item.frequency)
      if (streak.current > bestStreak) bestStreak = streak.current
      if (streak.best > bestStreak) bestStreak = streak.best
      totalCompleted += itemEntries.filter(e => e.value && e.value !== 'false' && e.value !== '').length
    }

    // Completion %: entries with value / (days * items) as a rough measure
    const totalExpected = durationDays * (items?.length || 1)
    const completionPct = Math.min(100, Math.round((totalCompleted / totalExpected) * 100))

    // Unique days checked in
    const checkedDays = new Set((allEntries || []).map(e => e.date)).size

    setStats({
      totalEntries: (allEntries || []).length,
      bestStreak,
      completionPct,
      durationDays,
      itemCount: items?.length || 0,
      checkedDays,
    })
    setPhase('confirm')
  }

  const handleClose = async (achieved) => {
    setGoalAchieved(achieved)
    setClosing(true)
    await supabase.from('usecases').update({
      closed_at: new Date().toISOString(),
      goal_achieved: achieved,
    }).eq('id', orbit.id)
    setClosing(false)
    setPhase(achieved ? 'celebrating' : 'done')
    setTimeout(() => onClosed(orbit.id, achieved), achieved ? 3500 : 2500)
  }

  const handleExtend = async () => {
    if (!extendDate) return
    await supabase.from('usecases').update({ end_date: extendDate }).eq('id', orbit.id)
    onExtend(orbit.id, extendDate)
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: '#000d', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 20 },
    box: { background: colors.bgCard, border: `1px solid ${colors.borderLight}`, borderRadius: 24, width: '100%', maxWidth: 480, overflow: 'hidden' },
    header: { padding: '28px 28px 20px', borderBottom: `1px solid ${colors.border}` },
    body: { padding: '24px 28px' },
    footer: { padding: '16px 28px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 10 },
    stat: { background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '14px 16px', textAlign: 'center', flex: 1 },
    statNum: { fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 800, color: colors.accent, display: 'block', lineHeight: 1.2 },
    statLabel: { fontSize: 11, color: colors.textDim, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.5px' },
    btn: { flex: 1, borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', border: 'none', transition: 'all 0.15s' },
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div style={s.overlay}>
      <div style={{ ...s.box, padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16, animation: 'spin 1.5s linear infinite' }}>⟳</div>
        <div style={{ color: colors.textDim, fontSize: 14 }}>Loading orbit stats...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  // ── Celebrating ───────────────────────────────────────────────────
  if (phase === 'celebrating') return (
    <div style={s.overlay}>
      <div style={{ ...s.box, padding: '48px 36px', textAlign: 'center', background: 'linear-gradient(135deg, #1a3a1a, #0d1a0d)' }}>
        <div style={{ fontSize: 64, marginBottom: 12, animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>🏆</div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 26, fontWeight: 800, color: '#22c55e', marginBottom: 8, letterSpacing: '-0.5px' }}>
          Goal Achieved!
        </div>
        <div style={{ fontSize: 15, color: '#86efac', lineHeight: 1.6, marginBottom: 20 }}>
          You did it. {orbit.icon} <strong>{orbit.name}</strong> is complete.
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <div style={{ ...s.stat, background: '#22c55e0e', borderColor: '#22c55e33' }}>
              <span style={{ ...s.statNum, color: '#22c55e' }}>{stats.bestStreak}</span>
              <span style={{ ...s.statLabel, color: '#86efac' }}>best streak</span>
            </div>
            <div style={{ ...s.stat, background: '#22c55e0e', borderColor: '#22c55e33' }}>
              <span style={{ ...s.statNum, color: '#22c55e' }}>{stats.checkedDays}</span>
              <span style={{ ...s.statLabel, color: '#86efac' }}>days tracked</span>
            </div>
            <div style={{ ...s.stat, background: '#22c55e0e', borderColor: '#22c55e33' }}>
              <span style={{ ...s.statNum, color: '#22c55e' }}>{stats.completionPct}%</span>
              <span style={{ ...s.statLabel, color: '#86efac' }}>completion</span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 13, color: '#4ade80', lineHeight: 1.7 }}>
          {stats?.durationDays} days of showing up.<br />That's what builds a life.
        </div>
        <style>{`@keyframes popIn { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }`}</style>
      </div>
    </div>
  )

  // ── Done (not achieved) ───────────────────────────────────────────
  if (phase === 'done') return (
    <div style={s.overlay}>
      <div style={{ ...s.box, padding: '48px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🌱</div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 800, color: colors.text, marginBottom: 8 }}>
          Orbit Closed
        </div>
        <div style={{ fontSize: 14, color: colors.textDim, lineHeight: 1.6 }}>
          Every attempt builds the foundation.<br />
          {stats?.checkedDays > 0 && `You showed up ${stats.checkedDays} days — that counts.`}
        </div>
      </div>
    </div>
  )

  // ── Confirm ───────────────────────────────────────────────────────
  const isExpired = orbit.end_date && orbit.end_date < new Date().toISOString().split('T')[0]

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>{orbit.icon}</span>
            <div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 18, fontWeight: 800, color: colors.text }}>{orbit.name}</div>
              {isExpired
                ? <div style={{ fontSize: 13, color: '#f59e0b', marginTop: 2 }}>Goal date reached · {orbit.end_date}</div>
                : <div style={{ fontSize: 13, color: colors.textDim, marginTop: 2 }}>Closing this orbit</div>
              }
            </div>
          </div>
        </div>

        <div style={s.body}>
          {/* Stats summary */}
          {stats && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <div style={s.stat}>
                <span style={s.statNum}>{stats.durationDays}</span>
                <span style={s.statLabel}>days running</span>
              </div>
              <div style={s.stat}>
                <span style={s.statNum}>{stats.checkedDays}</span>
                <span style={s.statLabel}>days checked</span>
              </div>
              <div style={s.stat}>
                <span style={s.statNum}>{stats.bestStreak}</span>
                <span style={s.statLabel}>best streak</span>
              </div>
              <div style={s.stat}>
                <span style={s.statNum}>{stats.completionPct}%</span>
                <span style={s.statLabel}>completion</span>
              </div>
            </div>
          )}

          {/* Goal question */}
          <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 16, textAlign: 'center' }}>
            Did you achieve your goal?
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              style={{ ...s.btn, background: goalAchieved === true ? '#22c55e' : '#22c55e18', color: goalAchieved === true ? '#fff' : '#22c55e', border: `2px solid ${goalAchieved === true ? '#22c55e' : '#22c55e44'}` }}
              onClick={() => setGoalAchieved(true)}
            >
              🎉 Yes, I did it!
            </button>
            <button
              style={{ ...s.btn, background: goalAchieved === false ? colors.border : colors.bg, color: goalAchieved === false ? colors.text : colors.textDim, border: `2px solid ${goalAchieved === false ? colors.borderLight : colors.border}` }}
              onClick={() => setGoalAchieved(false)}
            >
              Not quite
            </button>
          </div>

          {/* Extend option */}
          {!showExtend ? (
            <button
              onClick={() => setShowExtend(true)}
              style={{ background: 'none', border: 'none', color: colors.textDim, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', display: 'block', margin: '0 auto' }}
            >
              Extend the end date instead
            </button>
          ) : (
            <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: colors.textDim, flexShrink: 0 }}>New end date</span>
              <input
                type="date"
                value={extendDate}
                onChange={e => setExtendDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{ flex: 1, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 10px', color: colors.text, fontSize: 13, outline: 'none' }}
              />
              <button
                onClick={handleExtend}
                disabled={!extendDate}
                style={{ background: colors.accent, border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: extendDate ? 'pointer' : 'not-allowed', opacity: extendDate ? 1 : 0.5, fontFamily: 'Nunito, sans-serif' }}
              >
                Extend
              </button>
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button style={{ ...s.btn, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textDim }} onClick={onCancel}>
            Cancel
          </button>
          <button
            style={{ ...s.btn, background: goalAchieved !== null ? colors.accentGradient : colors.border, color: goalAchieved !== null ? '#fff' : colors.textDim, opacity: closing ? 0.7 : 1, cursor: goalAchieved !== null ? 'pointer' : 'not-allowed' }}
            onClick={() => goalAchieved !== null && !closing && handleClose(goalAchieved)}
            disabled={goalAchieved === null || closing}
          >
            {closing ? 'Closing...' : 'Close Orbit'}
          </button>
        </div>
      </div>
    </div>
  )
}
