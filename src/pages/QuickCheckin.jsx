import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

export default function QuickCheckin() {
  const { user, loading: authLoading } = useAuth()
  const { colors } = useTheme()
  const navigate = useNavigate()

  const [orbits, setOrbits] = useState([])
  const [currentOrbitIndex, setCurrentOrbitIndex] = useState(0)
  const [items, setItems] = useState([])
  const [entries, setEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/')
    } else if (user) {
      fetchUncheckedOrbits()
    }
  }, [user, authLoading])

  const fetchUncheckedOrbits = async () => {
    // Get all orbits
    const { data: allOrbits } = await supabase
      .from('usecases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')

    if (!allOrbits || allOrbits.length === 0) {
      setCompleted(true)
      setLoading(false)
      return
    }

    // Get today's entries
    const { data: todayEntries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id')
      .eq('user_id', user.id)
      .eq('date', today)

    const checkedItemIds = new Set(todayEntries?.map(e => e.checklist_item_id) || [])

    // Get items for all orbits
    const orbitIds = allOrbits.map(o => o.id)
    const { data: allItems } = await supabase
      .from('checklist_items')
      .select('*')
      .in('usecase_id', orbitIds)
      .order('created_at')

    // Find orbits with unchecked items
    const uncheckedOrbits = allOrbits.filter(orbit => {
      const orbitItems = allItems?.filter(i => i.usecase_id === orbit.id) || []
      return orbitItems.some(item => !checkedItemIds.has(item.id))
    })

    if (uncheckedOrbits.length === 0) {
      setCompleted(true)
      setLoading(false)
      return
    }

    setOrbits(uncheckedOrbits)

    // Load first orbit's items
    const firstOrbitItems = allItems?.filter(i => i.usecase_id === uncheckedOrbits[0].id) || []
    setItems(firstOrbitItems)

    // Load existing entries for first orbit
    const { data: existingEntries } = await supabase
      .from('checkin_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .in('checklist_item_id', firstOrbitItems.map(i => i.id))

    const entriesMap = {}
    existingEntries?.forEach(e => { entriesMap[e.checklist_item_id] = e })
    setEntries(entriesMap)

    setLoading(false)
  }

  const loadOrbitItems = async (orbit) => {
    const { data: orbitItems } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('usecase_id', orbit.id)
      .order('created_at')

    setItems(orbitItems || [])

    // Load existing entries
    const { data: existingEntries } = await supabase
      .from('checkin_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .in('checklist_item_id', (orbitItems || []).map(i => i.id))

    const entriesMap = {}
    existingEntries?.forEach(e => { entriesMap[e.checklist_item_id] = e })
    setEntries(entriesMap)
  }

  const saveEntry = async (itemId, value) => {
    setSaving(true)
    const existing = entries[itemId]

    if (existing) {
      await supabase
        .from('checkin_entries')
        .update({ value: String(value) })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('checkin_entries')
        .insert({
          checklist_item_id: itemId,
          user_id: user.id,
          date: today,
          value: String(value)
        })
    }

    setEntries(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], checklist_item_id: itemId, value: String(value) }
    }))
    setSaving(false)
  }

  const nextOrbit = async () => {
    if (currentOrbitIndex < orbits.length - 1) {
      const nextIndex = currentOrbitIndex + 1
      setCurrentOrbitIndex(nextIndex)
      await loadOrbitItems(orbits[nextIndex])
    } else {
      setCompleted(true)
    }
  }

  const snooze = () => {
    // Just go to dashboard for now
    navigate('/dashboard')
  }

  const currentOrbit = orbits[currentOrbitIndex]
  const checkedCount = items.filter(i => entries[i.id]?.value).length
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0

  const s = {
    page: {
      minHeight: '100vh',
      background: colors.bg,
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progress: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: 'Nunito, sans-serif',
    },
    snoozeBtn: {
      background: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '8px 16px',
      color: colors.textMuted,
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: 'Nunito, sans-serif',
    },
    content: {
      flex: 1,
      padding: '24px 20px',
      maxWidth: 500,
      margin: '0 auto',
      width: '100%',
    },
    orbitHeader: {
      textAlign: 'center',
      marginBottom: 32,
    },
    orbitIcon: {
      fontSize: 56,
      marginBottom: 12,
    },
    orbitName: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 28,
      fontWeight: 800,
      color: colors.text,
      marginBottom: 8,
    },
    progressBar: {
      height: 6,
      background: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 16,
    },
    progressFill: {
      height: '100%',
      background: colors.accentGradient,
      borderRadius: 3,
      transition: 'width 0.3s ease',
    },
    itemCard: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: '20px',
      marginBottom: 12,
    },
    itemLabel: {
      fontSize: 16,
      color: colors.text,
      fontFamily: 'Nunito, sans-serif',
      fontWeight: 600,
      marginBottom: 12,
    },
    checkbox: {
      width: 32,
      height: 32,
      accentColor: colors.accent,
      cursor: 'pointer',
    },
    scoreContainer: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
    },
    scoreBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      border: `1px solid ${colors.border}`,
      background: 'transparent',
      color: colors.textDim,
      cursor: 'pointer',
      fontSize: 15,
      fontWeight: 600,
      transition: 'all 0.15s',
    },
    scoreBtnActive: {
      background: colors.accent,
      borderColor: colors.accent,
      color: '#fff',
    },
    input: {
      width: '100%',
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      padding: '12px 16px',
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Nunito, sans-serif',
      outline: 'none',
    },
    footer: {
      padding: '20px',
      borderTop: `1px solid ${colors.border}`,
    },
    nextBtn: {
      width: '100%',
      background: colors.accentGradient,
      border: 'none',
      borderRadius: 14,
      padding: '18px',
      color: '#fff',
      fontSize: 17,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
    },
    completedPage: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 40,
      textAlign: 'center',
    },
    completedIcon: {
      fontSize: 80,
      marginBottom: 24,
    },
    completedTitle: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 32,
      fontWeight: 800,
      color: colors.text,
      marginBottom: 12,
    },
    completedText: {
      fontSize: 16,
      color: colors.textMuted,
      marginBottom: 32,
    },
    doneBtn: {
      background: colors.accentGradient,
      border: 'none',
      borderRadius: 14,
      padding: '16px 40px',
      color: '#fff',
      fontSize: 16,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
    },
  }

  if (authLoading || loading) {
    return (
      <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: colors.textMuted }}>Loading...</div>
      </div>
    )
  }

  if (completed) {
    return (
      <div style={{ ...s.page, background: colors.bg }}>
        <div style={s.completedPage}>
          <div style={s.completedIcon}>🎉</div>
          <h1 style={s.completedTitle}>All done!</h1>
          <p style={s.completedText}>
            {orbits.length > 0
              ? `You've completed check-ins for ${orbits.length} orbit${orbits.length > 1 ? 's' : ''} today.`
              : 'All your orbits are checked in for today!'}
          </p>
          <button style={s.doneBtn} onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.progress}>
          {currentOrbitIndex + 1} of {orbits.length} orbits
        </div>
        <button style={s.snoozeBtn} onClick={snooze}>
          ⏰ Snooze
        </button>
      </div>

      {/* Content */}
      <div style={s.content}>
        <div style={s.orbitHeader}>
          <div style={s.orbitIcon}>{currentOrbit?.icon}</div>
          <h1 style={s.orbitName}>{currentOrbit?.name}</h1>
          <div style={{ fontSize: 14, color: colors.textMuted }}>
            {checkedCount} of {items.length} items
          </div>
          <div style={s.progressBar}>
            <div style={{ ...s.progressFill, width: `${progress}%` }} />
          </div>
        </div>

        {items.map(item => (
          <div key={item.id} style={s.itemCard}>
            <div style={s.itemLabel}>{item.label}</div>

            {item.value_type === 'checkbox' && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  style={s.checkbox}
                  checked={entries[item.id]?.value === 'true'}
                  onChange={e => saveEntry(item.id, e.target.checked)}
                />
              </div>
            )}

            {item.value_type === 'score' && (
              <div style={s.scoreContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    style={{
                      ...s.scoreBtn,
                      ...(Number(entries[item.id]?.value) === n ? s.scoreBtnActive : {})
                    }}
                    onClick={() => saveEntry(item.id, n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {(item.value_type === 'number' || item.value_type === 'text') && (
              <input
                type={item.value_type === 'number' ? 'number' : 'text'}
                style={s.input}
                value={entries[item.id]?.value || ''}
                onChange={e => saveEntry(item.id, e.target.value)}
                placeholder={item.value_type === 'number' ? 'Enter number...' : 'Enter text...'}
              />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <button style={s.nextBtn} onClick={nextOrbit}>
          {currentOrbitIndex < orbits.length - 1 ? 'Next Orbit →' : 'Complete ✓'}
        </button>
      </div>
    </div>
  )
}
