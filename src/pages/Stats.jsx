import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getClaudeAnalysis } from '../lib/claude'
import Navbar from '../components/Navbar'
import { format, subDays, startOfWeek, eachDayOfInterval } from 'date-fns'

export default function Stats() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [usecase, setUsecase] = useState(null)
  const [items, setItems] = useState([])
  const [entries, setEntries] = useState([])
  const [period, setPeriod] = useState('week') // week | month
  const [analysis, setAnalysis] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id, period])

  const fetchData = async () => {
    const { data: uc } = await supabase.from('usecases').select('*').eq('id', id).single()
    setUsecase(uc)

    const { data: its } = await supabase.from('checklist_items').select('*').eq('usecase_id', id)
    setItems(its || [])

    const days = period === 'week' ? 7 : 30
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd')

    // Only query entries if we have items
    const itemIds = (its || []).map(i => i.id)
    if (itemIds.length === 0) {
      setEntries([])
      setLoading(false)
      return
    }

    const { data: ens, error } = await supabase
      .from('checkin_entries')
      .select('*')
      .eq('user_id', user.id)
      .in('checklist_item_id', itemIds)
      .gte('date', since)
      .order('date')

    if (error) {
      console.error('Error fetching entries:', error)
    }

    setEntries(ens || [])
    setLoading(false)
  }

  const runAIAnalysis = async () => {
    setLoadingAI(true)
    const result = await getClaudeAnalysis(usecase?.name, entries, items)
    setAnalysis(result)
    setLoadingAI(false)
  }

  // Build chart data: completion % per day
  const numDays = period === 'week' ? 7 : 30
  const dateRange = eachDayOfInterval({ start: subDays(new Date(), numDays - 1), end: new Date() })
  const chartData = dateRange.map(d => {
    const dateStr = format(d, 'yyyy-MM-dd')
    // Compare dates as strings in yyyy-MM-dd format
    const dayEntries = entries.filter(e => {
      const entryDate = typeof e.date === 'string' ? e.date.split('T')[0] : format(new Date(e.date), 'yyyy-MM-dd')
      return entryDate === dateStr
    })
    const completed = dayEntries.filter(e => {
      if (e.value === 'true') return true
      if (e.value && e.value !== 'false' && e.value !== '0' && e.value !== '') return true
      return false
    }).length
    return {
      date: format(d, period === 'week' ? 'EEE' : 'MMM d'),
      fullDate: dateStr,
      completion: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
      entries: dayEntries.length,
    }
  })

  // Per-item stats
  const itemStats = items.map(item => {
    const itemEntries = entries.filter(e => e.checklist_item_id === item.id)
    const total = itemEntries.length
    if (item.value_type === 'checkbox') {
      const done = itemEntries.filter(e => e.value === 'true').length
      return { ...item, stat: `${done}/${numDays} days`, pct: numDays > 0 ? Math.round((done / numDays) * 100) : 0 }
    }
    if (item.value_type === 'score') {
      const avg = total > 0 ? (itemEntries.reduce((a, e) => a + Number(e.value), 0) / total).toFixed(1) : 'N/A'
      return { ...item, stat: `Avg: ${avg}/10`, pct: avg !== 'N/A' ? Math.round((avg / 10) * 100) : 0 }
    }
    return { ...item, stat: `${total} entries`, pct: Math.round((total / numDays) * 100) }
  })

  // Items that need focus (below 50% or low scores)
  const needsFocus = itemStats.filter(item => {
    if (item.pct < 50) return true
    if (item.value_type === 'score' && item.pct < 60) return true
    return false
  }).sort((a, b) => a.pct - b.pct)

  // Overall score
  const overallPct = itemStats.length > 0
    ? Math.round(itemStats.reduce((sum, i) => sum + i.pct, 0) / itemStats.length)
    : 0

  const s = {
    page: { minHeight: '100vh', background: '#080810' },
    content: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
    back: { background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 14, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 },
    title: { fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: '#e8e4f0', display: 'flex', alignItems: 'center', gap: 12 },
    periodToggle: { display: 'flex', background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 10, overflow: 'hidden' },
    periodBtn: { padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' },
    card: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 20, padding: 28, marginBottom: 20 },
    cardTitle: { fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#e8e4f0', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
    statRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 },
    statLabel: { flex: 1, fontSize: 14, color: '#c8c0e0' },
    statBar: { width: 140, height: 6, background: '#1a1a2e', borderRadius: 4, overflow: 'hidden' },
    statFill: { height: '100%', background: 'linear-gradient(90deg, #6c63ff, #9b59b6)', borderRadius: 4, transition: 'width 0.6s ease' },
    statVal: { fontSize: 13, color: '#6c63ff', width: 80, textAlign: 'right', fontFamily: 'monospace' },
    aiBtn: {
      background: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
      border: 'none', borderRadius: 12, padding: '14px 28px',
      color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'DM Sans, sans-serif', width: '100%', marginBottom: 20,
    },
    analysisCard: { background: '#0a0a1a', border: '1px solid #2a2a40', borderRadius: 16, padding: 28, marginBottom: 20 },
    trendText: { fontSize: 15, color: '#c8c0e0', lineHeight: 1.7, marginBottom: 24 },
    sectionTitle: { fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#6c63ff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 },
    listItem: { fontSize: 14, color: '#a89fff', lineHeight: 1.6, marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #6c63ff44' },
    nextStep: { fontSize: 14, color: '#e8e4f0', lineHeight: 1.6, marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #9b59b6' },
    tooltipStyle: { background: '#0d0d1a', border: '1px solid #2a2a40', borderRadius: 8, fontSize: 12, color: '#e8e4f0' },
    focusCard: {
      background: 'linear-gradient(135deg, #1a1520 0%, #0d0d1a 100%)',
      border: '1px solid #3d2a4a',
      borderRadius: 20,
      padding: 28,
      marginBottom: 20,
    },
    focusItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: '#0a0a14',
      borderRadius: 12,
      marginBottom: 8,
      border: '1px solid #2a1a3a',
    },
    focusPct: {
      width: 44,
      height: 44,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontWeight: 700,
      fontFamily: 'monospace',
    },
    focusLabel: {
      flex: 1,
      fontSize: 14,
      color: '#e8e4f0',
    },
    focusTip: {
      fontSize: 12,
      color: '#9b8fb8',
      marginTop: 2,
    },
    overallScore: {
      textAlign: 'center',
      padding: '20px 0',
      marginBottom: 20,
    },
    scoreCircle: {
      width: 80,
      height: 80,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 28,
      fontWeight: 800,
      fontFamily: 'Syne, sans-serif',
      marginBottom: 8,
    },
    scoreLabel: {
      fontSize: 14,
      color: '#4a4870',
    },
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={s.tooltipStyle}>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ color: '#6c63ff', marginBottom: 4 }}>{label}</div>
            <div>{payload[0]?.value}% completion</div>
          </div>
        </div>
      )
    }
    return null
  }

  if (loading) return <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#4a4870' }}>Loading...</div></div>

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.content}>
        <button style={s.back} onClick={() => navigate(`/usecase/${id}`)}>← Back to Check-In</button>

        <div style={s.header}>
          <div style={s.title}>
            <span>{usecase?.icon}</span>
            <span>Check Your Progress</span>
          </div>
          <div style={s.periodToggle}>
            {['week', 'month'].map(p => (
              <button
                key={p}
                style={{
                  ...s.periodBtn,
                  background: period === p ? '#6c63ff' : 'transparent',
                  color: period === p ? '#fff' : '#4a4870',
                }}
                onClick={() => setPeriod(p)}
              >
                {p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Overall Score */}
        {itemStats.length > 0 && (
          <div style={s.overallScore}>
            <div
              style={{
                ...s.scoreCircle,
                background: overallPct >= 70 ? 'linear-gradient(135deg, #2d4a2d, #1a3a1a)'
                  : overallPct >= 40 ? 'linear-gradient(135deg, #4a4a2d, #3a3a1a)'
                  : 'linear-gradient(135deg, #4a2d2d, #3a1a1a)',
                color: overallPct >= 70 ? '#7dba7d' : overallPct >= 40 ? '#baba7d' : '#ba7d7d',
                border: `2px solid ${overallPct >= 70 ? '#3d6a3d' : overallPct >= 40 ? '#6a6a3d' : '#6a3d3d'}`,
              }}
            >
              {overallPct}%
            </div>
            <div style={s.scoreLabel}>
              {overallPct >= 70 ? 'Great progress!' : overallPct >= 40 ? 'Room to improve' : 'Needs attention'}
            </div>
          </div>
        )}

        {/* Needs Focus Section */}
        {needsFocus.length > 0 && (
          <div style={s.focusCard}>
            <div style={s.cardTitle}>🎯 Needs More Focus</div>
            {needsFocus.slice(0, 3).map(item => (
              <div key={item.id} style={s.focusItem}>
                <div
                  style={{
                    ...s.focusPct,
                    background: item.pct < 30 ? '#3a1a1a' : '#3a2a1a',
                    color: item.pct < 30 ? '#ff6b6b' : '#ffaa6b',
                    border: `1px solid ${item.pct < 30 ? '#5a2a2a' : '#5a4a2a'}`,
                  }}
                >
                  {item.pct}%
                </div>
                <div>
                  <div style={s.focusLabel}>{item.label}</div>
                  <div style={s.focusTip}>
                    {item.value_type === 'checkbox'
                      ? `Only completed ${item.stat.split('/')[0]} of the last ${numDays} days`
                      : item.value_type === 'score'
                      ? `Average score is ${item.stat.split(': ')[1]}`
                      : `${item.stat} in ${numDays} days`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completion chart */}
        <div style={s.card}>
          <div style={s.cardTitle}>📈 Daily Completion Rate</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={period === 'week' ? 32 : 12}>
              <XAxis dataKey="date" tick={{ fill: '#3a3858', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a3858', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#6c63ff11' }} />
              <Bar dataKey="completion" fill="#6c63ff" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-item stats */}
        <div style={s.card}>
          <div style={s.cardTitle}>📋 Item Breakdown</div>
          {itemStats.length === 0 ? (
            <div style={{ color: '#2a2840', fontSize: 14 }}>No items added yet.</div>
          ) : (
            itemStats.map(item => (
              <div key={item.id} style={s.statRow}>
                <div style={s.statLabel}>{item.label}</div>
                <div style={s.statBar}>
                  <div style={{ ...s.statFill, width: `${Math.min(item.pct, 100)}%` }} />
                </div>
                <div style={s.statVal}>{item.stat}</div>
              </div>
            ))
          )}
        </div>

        {/* AI Analysis */}
        <div style={s.card}>
          <div style={s.cardTitle}>🤖 AI Trend Analysis</div>
          {!analysis ? (
            <button
              style={s.aiBtn}
              onClick={runAIAnalysis}
              disabled={loadingAI}
            >
              {loadingAI ? '⟳ Analyzing your data...' : '✨ Generate Claude AI Analysis'}
            </button>
          ) : (
            <div style={s.analysisCard}>
              <p style={s.trendText}>{analysis.trend}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div>
                  <div style={s.sectionTitle}>🏆 Wins</div>
                  {analysis.wins?.map((w, i) => <div key={i} style={s.listItem}>{w}</div>)}
                </div>
                <div>
                  <div style={s.sectionTitle}>👀 Watch Areas</div>
                  {analysis.watchAreas?.map((w, i) => <div key={i} style={s.listItem}>{w}</div>)}
                </div>
              </div>

              <div style={s.sectionTitle}>🎯 Next Steps</div>
              {analysis.nextSteps?.map((step, i) => (
                <div key={i} style={s.nextStep}>{i + 1}. {step}</div>
              ))}

              <button
                style={{ ...s.aiBtn, marginTop: 20, marginBottom: 0, background: 'transparent', border: '1px solid #2a2a40', color: '#4a4870', fontSize: 13 }}
                onClick={() => { setAnalysis(null) }}
              >
                Regenerate Analysis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
