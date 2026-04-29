import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { calculateStreak } from '../lib/streaks'
import Navbar from '../components/Navbar'
import OrbitChat from '../components/OrbitChat'
import { format, subDays, eachDayOfInterval } from 'date-fns'

export default function Analytics() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const navigate = useNavigate()
  const [orbits, setOrbits] = useState([])
  const [stats, setStats] = useState({}) // { orbitId: { pct, items: [...], streak } }
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(7) // 7 or 30 days

  useEffect(() => { fetchData() }, [period])

  const fetchData = async () => {
    setLoading(true)
    const { data: orbitData } = await supabase
      .from('usecases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')

    setOrbits(orbitData || [])
    if (!orbitData?.length) { setLoading(false); return }

    const orbitIds = orbitData.map(o => o.id)
    const { data: allItems } = await supabase
      .from('checklist_items')
      .select('*')
      .in('usecase_id', orbitIds)

    const since = format(subDays(new Date(), period), 'yyyy-MM-dd')
    const { data: allEntries } = await supabase
      .from('checkin_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', since)
      .in('checklist_item_id', (allItems || []).map(i => i.id))

    const dateRange = eachDayOfInterval({ start: subDays(new Date(), period - 1), end: new Date() })

    const result = {}
    for (const orbit of orbitData) {
      const orbitItems = (allItems || []).filter(i => i.usecase_id === orbit.id)

      // Per-item stats
      const itemStats = orbitItems.map(item => {
        const itemEntries = (allEntries || []).filter(e => e.checklist_item_id === item.id)
        const streakData = calculateStreak(
          itemEntries.map(e => ({ date: e.date, value: e.value })),
          item.frequency
        )

        let completed = 0, total = 0
        if (item.value_type === 'checkbox') {
          completed = itemEntries.filter(e => e.value === 'true').length
          total = dateRange.length
        } else if (item.value_type === 'score') {
          const vals = itemEntries.map(e => Number(e.value)).filter(n => !isNaN(n) && n > 0)
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
          return { ...item, pct: avg > 0 ? Math.round((avg / 10) * 100) : 0, stat: avg > 0 ? `avg ${avg.toFixed(1)}/10` : 'no data', streak: streakData }
        } else {
          completed = itemEntries.filter(e => e.value && e.value.trim() !== '').length
          total = dateRange.length
        }
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0
        return { ...item, pct, stat: `${completed}/${total}`, streak: streakData }
      })

      // Orbit-level streak (best across items)
      const bestStreak = itemStats.reduce((best, i) => Math.max(best, i.streak?.current || 0), 0)
      const atRisk = itemStats.some(i => i.streak?.atRisk)
      const orbitPct = itemStats.length > 0
        ? Math.round(itemStats.reduce((sum, i) => sum + i.pct, 0) / itemStats.length)
        : 0

      result[orbit.id] = { pct: orbitPct, items: itemStats, streak: bestStreak, atRisk }
    }

    setStats(result)
    setLoading(false)
  }

  const getPctColor = (pct) => {
    if (pct >= 70) return '#22c55e'
    if (pct >= 40) return '#f59e0b'
    return '#ef4444'
  }

  const s = {
    page: { minHeight: '100vh', background: colors.bg },
    content: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
    back: { background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 14, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Nunito, sans-serif' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    title: { fontFamily: 'Nunito, sans-serif', fontSize: 28, fontWeight: 800, color: colors.text, letterSpacing: '-0.5px' },
    periodToggle: { display: 'flex', background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' },
    periodBtn: { padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif', transition: 'all 0.2s' },
    orbitCard: { background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 20, padding: '20px 24px', marginBottom: 16 },
    orbitHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
    orbitName: { fontFamily: 'Nunito, sans-serif', fontSize: 17, fontWeight: 700, color: colors.text, flex: 1 },
    pctCircle: { width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, fontFamily: 'Nunito, sans-serif', flexShrink: 0 },
    barTrack: { background: colors.border, borderRadius: 4, height: 5, overflow: 'hidden', flex: 1 },
    itemRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
    itemLabel: { fontSize: 13, color: colors.textMuted, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 },
    itemStat: { fontSize: 12, color: colors.textDim, width: 70, textAlign: 'right', fontFamily: 'monospace' },
    statsBtn: { background: colors.accent + '18', border: `1px solid ${colors.accent}33`, borderRadius: 8, padding: '6px 14px', color: colors.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', whiteSpace: 'nowrap' },
  }

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.content}>
        <button style={s.back} onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>

        <div style={s.header}>
          <div>
            <h1 style={s.title}>📊 Overall Stats</h1>
            <div style={{ fontSize: 13, color: colors.textDim, marginTop: 4 }}>
              How you're doing across every orbit and task
            </div>
          </div>
          <div style={s.periodToggle}>
            {[7, 30].map(p => (
              <button
                key={p}
                style={{ ...s.periodBtn, background: period === p ? colors.accent : 'transparent', color: period === p ? '#fff' : colors.textDim }}
                onClick={() => setPeriod(p)}
              >
                {p === 7 ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1,2,3].map(i => <div key={i} style={{ ...s.orbitCard, height: 140, animation: 'pulse 1.5s ease infinite' }} />)}
          </div>
        ) : orbits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.textDim }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌌</div>
            <div style={{ fontSize: 16, color: colors.textMuted }}>No orbits yet</div>
          </div>
        ) : (
          orbits.map(orbit => {
            const orbitStats = stats[orbit.id]
            if (!orbitStats) return null
            const pct = orbitStats.pct
            const pctColor = getPctColor(pct)

            return (
              <div key={orbit.id} style={s.orbitCard}>
                <div style={s.orbitHeader}>
                  <span style={{ fontSize: 28 }}>{orbit.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={s.orbitName}>
                      {orbit.name}
                      {orbitStats.streak > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: orbitStats.atRisk ? '#f59e0b' : '#22c55e', background: (orbitStats.atRisk ? '#f59e0b' : '#22c55e') + '18', padding: '2px 8px', borderRadius: 10 }}>
                          {orbitStats.atRisk ? '⚠️' : '🔥'} {orbitStats.streak} days
                        </span>
                      )}
                    </div>
                    {/* Overall orbit bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={s.barTrack}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pctColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontSize: 12, color: pctColor, fontWeight: 700, width: 36, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </div>
                  <button style={s.statsBtn} onClick={() => navigate(`/usecase/${orbit.id}/stats`)}>
                    Full Stats →
                  </button>
                </div>

                {/* Per-item breakdown */}
                {orbitStats.items.length > 0 && (
                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
                    {orbitStats.items.map(item => {
                      const itemColor = getPctColor(item.pct)
                      return (
                        <div key={item.id} style={s.itemRow}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: itemColor, flexShrink: 0 }} />
                          <div style={s.itemLabel} title={item.label}>{item.label}</div>
                          <div style={s.barTrack}>
                            <div style={{ height: '100%', width: `${Math.min(item.pct, 100)}%`, background: itemColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
                          </div>
                          <div style={s.itemStat}>{item.stat}</div>
                          {item.streak?.current > 0 && (
                            <span style={{ fontSize: 11, color: item.streak.atRisk ? '#f59e0b' : '#22c55e', width: 40, textAlign: 'right' }}>
                              {item.streak.atRisk ? '⚠️' : '🔥'}{item.streak.current}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      <OrbitChat orbits={orbits} stats={stats} />
      <style>{`@keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </div>
  )
}
