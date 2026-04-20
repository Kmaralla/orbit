import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { playCheckSound, playLogSound } from '../lib/sounds'

// Always use local date — toISOString() is UTC and breaks for late-night EST/IST users
const getLocalToday = () =>
  new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]

export default function QuickCheckin() {
  const { user, loading: authLoading } = useAuth()
  const { colors } = useTheme()
  const navigate = useNavigate()

  const [sections, setSections] = useState([])   // [{ orbit, items }]
  const [entries, setEntries] = useState({})      // { itemId: value }
  const [saving, setSaving] = useState({})
  const [loading, setLoading] = useState(true)
  const [allDone, setAllDone] = useState(false)
  const bottomRef = useRef(null)

  const today = getLocalToday()
  const todayDayOfWeek = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]

  const isScheduledToday = (freq) => {
    if (!freq || freq === 'daily') return true
    if (freq === 'weekdays') return ['mon','tue','wed','thu','fri'].includes(todayDayOfWeek)
    if (freq === 'weekly') return todayDayOfWeek === 'mon'
    if (freq.startsWith('custom:')) return freq.split(':')[1]?.split(',').includes(todayDayOfWeek)
    return true
  }

  useEffect(() => {
    if (!authLoading && !user) navigate('/')
    else if (user) load()
  }, [user, authLoading])

  const load = async () => {
    const { data: orbits } = await supabase
      .from('usecases').select('*')
      .eq('user_id', user.id).is('closed_at', null).is('paused_at', null)
      .order('created_at')

    if (!orbits?.length) { setAllDone(true); setLoading(false); return }

    const orbitIds = orbits.map(o => o.id)
    const { data: allItems } = await supabase
      .from('checklist_items').select('*').in('usecase_id', orbitIds).order('sort_order', { nullsFirst: false }).order('created_at')

    const { data: todayEntries } = await supabase
      .from('checkin_entries').select('*')
      .eq('user_id', user.id).eq('date', today)

    const entriesMap = {}
    todayEntries?.forEach(e => { entriesMap[e.checklist_item_id] = e.value })

    // Build sections — orbits that have at least one item scheduled today
    const built = orbits.map(orbit => {
      const items = (allItems || [])
        .filter(i => i.usecase_id === orbit.id && isScheduledToday(i.frequency))
      return { orbit, items }
    }).filter(s => s.items.length > 0)

    if (built.length === 0) { setAllDone(true); setLoading(false); return }

    setSections(built)
    setEntries(entriesMap)
    setLoading(false)
  }

  const saveEntry = async (itemId, value, valueType) => {
    setSaving(prev => ({ ...prev, [itemId]: true }))
    const strVal = String(value)
    setEntries(prev => ({ ...prev, [itemId]: strVal }))

    await supabase.from('checkin_entries').upsert({
      checklist_item_id: itemId, user_id: user.id, date: today, value: strVal,
    }, { onConflict: 'checklist_item_id,user_id,date' })

    setSaving(prev => ({ ...prev, [itemId]: false }))
    valueType === 'checkbox' ? playCheckSound() : playLogSound()

    // Check if everything is now done
    const allItemIds = sections.flatMap(s => s.items.map(i => i.id))
    const newEntries = { ...entries, [itemId]: strVal }
    const done = allItemIds.every(id => {
      const v = newEntries[id]; return v && v !== '' && v !== 'false'
    })
    if (done) setTimeout(() => setAllDone(true), 400)
  }

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0)
  const doneCount = sections.flatMap(s => s.items).filter(i => {
    const v = entries[i.id]; return v && v !== '' && v !== 'false'
  }).length
  const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )

  if (allDone) return (
    <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 30, fontWeight: 900, color: colors.text, marginBottom: 10 }}>All done!</div>
      <div style={{ fontSize: 15, color: colors.textDim, marginBottom: 8 }}>
        {doneCount > 0 ? `${doneCount} item${doneCount !== 1 ? 's' : ''} checked in today. Streaks building.` : 'Everything is already checked in today!'}
      </div>
      <div style={{ fontSize: 13, color: colors.textDim, marginBottom: 32 }}>Small wins every day = big results over time.</div>
      <button
        onClick={() => navigate('/dashboard')}
        style={{ background: colors.accent, border: 'none', borderRadius: 14, padding: '14px 36px', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
      >
        Back to Dashboard →
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: colors.bg }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: colors.bg, borderBottom: `1px solid ${colors.border}`, padding: '14px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 16, color: colors.text }}>Today's Check-in</span>
              <span style={{ fontSize: 13, color: colors.textDim, marginLeft: 10 }}>{doneCount}/{totalItems} done</span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 14px', color: colors.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
            >
              Dashboard
            </button>
          </div>
          {/* Overall progress bar */}
          <div style={{ height: 5, background: colors.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : colors.accentGradient, borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      {/* All sections */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 20px 60px' }}>
        {sections.map(({ orbit, items }) => {
          const orbitDone = items.every(i => { const v = entries[i.id]; return v && v !== '' && v !== 'false' })
          const orbitDoneCount = items.filter(i => { const v = entries[i.id]; return v && v !== '' && v !== 'false' }).length

          return (
            <div key={orbit.id} style={{ marginBottom: 24 }}>
              {/* Orbit header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{orbit.icon}</span>
                <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 16, fontWeight: 800, color: orbitDone ? '#22c55e' : colors.text, flex: 1 }}>{orbit.name}</span>
                {orbitDone
                  ? <span style={{ fontSize: 12, fontWeight: 700, background: '#22c55e22', color: '#22c55e', padding: '3px 10px', borderRadius: 10 }}>✓ Done</span>
                  : <span style={{ fontSize: 12, color: colors.textDim }}>{orbitDoneCount}/{items.length}</span>
                }
              </div>

              {/* Items */}
              <div style={{ background: colors.bgCard, border: `1px solid ${orbitDone ? '#22c55e44' : colors.border}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.3s' }}>
                {items.map((item, idx) => {
                  const val = entries[item.id]
                  const done = val && val !== '' && val !== 'false'
                  const isLast = idx === items.length - 1

                  return (
                    <div
                      key={item.id}
                      style={{ padding: '14px 16px', borderBottom: isLast ? 'none' : `1px solid ${colors.border}`, background: done ? '#22c55e08' : 'transparent', transition: 'background 0.2s' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Checkbox */}
                        {item.value_type === 'checkbox' && (
                          <button
                            onClick={() => saveEntry(item.id, !done, 'checkbox')}
                            style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${done ? '#22c55e' : colors.accent}`, background: done ? '#22c55e' : 'transparent', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
                          >
                            {done ? '✓' : ''}
                          </button>
                        )}
                        <span style={{ flex: 1, fontSize: 14, color: done ? colors.textDim : colors.text, textDecoration: done ? 'line-through' : 'none', fontFamily: 'Nunito, sans-serif', fontWeight: 600 }}>
                          {item.label}
                        </span>
                        {saving[item.id] && <span style={{ fontSize: 10, color: colors.accent }}>•••</span>}
                      </div>

                      {/* Score */}
                      {item.value_type === 'score' && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10, paddingLeft: 40 }}>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <button
                              key={n}
                              onClick={() => saveEntry(item.id, n, 'score')}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${Number(val) === n ? colors.accent : colors.border}`, background: Number(val) === n ? colors.accent : 'transparent', color: Number(val) === n ? '#fff' : colors.textDim, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                            >{n}</button>
                          ))}
                        </div>
                      )}

                      {/* Number */}
                      {item.value_type === 'number' && (
                        <input
                          type="number"
                          placeholder="0"
                          defaultValue={val || ''}
                          key={item.id + (val ?? '')}
                          style={{ marginTop: 10, marginLeft: 40, width: 100, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 12px', color: colors.text, fontSize: 14, outline: 'none', fontFamily: 'Nunito, sans-serif' }}
                          onBlur={e => { if (e.target.value) saveEntry(item.id, e.target.value, 'number') }}
                          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        />
                      )}

                      {/* Text */}
                      {item.value_type === 'text' && (
                        <textarea
                          placeholder="Add a note..."
                          defaultValue={val || ''}
                          key={item.id + (val ?? '')}
                          rows={2}
                          style={{ marginTop: 10, marginLeft: 40, width: 'calc(100% - 40px)', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 12px', color: colors.text, fontSize: 13, outline: 'none', fontFamily: 'Nunito, sans-serif', resize: 'none' }}
                          onBlur={e => { if (e.target.value) saveEntry(item.id, e.target.value, 'text') }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Finish CTA */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{ width: '100%', background: pct === 100 ? '#22c55e' : colors.accent, border: 'none', borderRadius: 14, padding: '16px', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', marginTop: 8, transition: 'background 0.3s' }}
        >
          {pct === 100 ? '🎉 All done — back to Dashboard' : `Done for now → Dashboard (${pct}% complete)`}
        </button>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
