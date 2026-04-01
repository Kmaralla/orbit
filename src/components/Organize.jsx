import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import { getOrganizeSuggestions } from '../lib/claude'

const TYPE_ICONS = {
  remove_task: '🗑️',
  change_frequency: '📅',
  merge_orbits: '🔀',
  pause_orbit: '⏸️',
  spotlight: '🌟',
}

const TYPE_LABELS = {
  remove_task: 'Remove task',
  change_frequency: 'Change frequency',
  merge_orbits: 'Merge orbits',
  pause_orbit: 'Pause orbit',
  spotlight: 'Spotlight',
}

export default function Organize({ orbits, userId, onClose }) {
  const { colors } = useTheme()
  const [phase, setPhase] = useState('loading') // loading | ready | applying | done | error
  const [result, setResult] = useState(null)
  const [dismissed, setDismissed] = useState(new Set())
  const [applying, setApplying] = useState(null)

  useEffect(() => { analyze() }, [])

  const analyze = async () => {
    setPhase('loading')
    const orbitIds = orbits.map(o => o.id)

    // Fetch all items
    const { data: items } = await supabase
      .from('checklist_items').select('*').in('usecase_id', orbitIds)

    // Fetch 90 days of completion data
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const { data: entries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, date, value')
      .eq('user_id', userId)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])

    // Build completion stats per task
    const entryMap = {}
    for (const e of (entries || [])) {
      if (!entryMap[e.checklist_item_id]) entryMap[e.checklist_item_id] = []
      entryMap[e.checklist_item_id].push(e)
    }

    const completionData = orbits.map(orbit => {
      const orbitItems = (items || []).filter(i => i.usecase_id === orbit.id)
      const tasks = orbitItems.map(item => {
        const itemEntries = entryMap[item.id] || []
        const doneEntries = itemEntries.filter(e => e.value && e.value !== '' && e.value !== 'false')
        const freq = item.frequency || 'daily'
        // Expected days in 90-day window
        const expectedDays = freq === 'daily' ? 90 : freq === 'weekdays' ? 64 : freq === 'weekly' ? 13 : 90
        const completionRate = Math.round((doneEntries.length / Math.max(expectedDays, 1)) * 100)
        const lastDone = doneEntries.sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null
        return {
          id: item.id,
          label: item.label,
          valueType: item.value_type,
          frequency: freq,
          completionRate,
          totalDone: doneEntries.length,
          lastDone,
          daysSinceLastDone: lastDone
            ? Math.round((Date.now() - new Date(lastDone)) / 86400000)
            : 90,
        }
      })
      const orbitCompletionRate = tasks.length > 0
        ? Math.round(tasks.reduce((s, t) => s + t.completionRate, 0) / tasks.length)
        : 0
      return {
        id: orbit.id,
        name: orbit.name,
        icon: orbit.icon,
        description: orbit.description || '',
        overallCompletionRate: orbitCompletionRate,
        taskCount: tasks.length,
        tasks,
      }
    })

    const data = await getOrganizeSuggestions(orbits, completionData)
    if (!data) {
      setPhase('error')
      return
    }
    setResult(data)
    setPhase('ready')
  }

  const applySuggestion = async (suggestion) => {
    setApplying(suggestion.type + (suggestion.taskLabel || '') + (suggestion.orbitId || ''))

    try {
      if (suggestion.type === 'remove_task') {
        // Find and delete the task by label in this orbit
        const { data: items } = await supabase
          .from('checklist_items')
          .select('id')
          .eq('usecase_id', suggestion.orbitId)
          .ilike('label', suggestion.taskLabel)
        if (items?.length) {
          await supabase.from('checklist_items').delete().eq('id', items[0].id)
        }
      } else if (suggestion.type === 'change_frequency') {
        const { data: items } = await supabase
          .from('checklist_items')
          .select('id')
          .eq('usecase_id', suggestion.orbitId)
          .ilike('label', suggestion.taskLabel)
        if (items?.length) {
          await supabase.from('checklist_items').update({ frequency: suggestion.newFrequency }).eq('id', items[0].id)
        }
      } else if (suggestion.type === 'pause_orbit') {
        await supabase.from('usecases').update({ closed_at: new Date().toISOString() }).eq('id', suggestion.orbitId)
      } else if (suggestion.type === 'merge_orbits') {
        // Move all checklist items from orbitId into targetOrbitId
        const { data: items } = await supabase
          .from('checklist_items').select('id').eq('usecase_id', suggestion.orbitId)
        if (items?.length) {
          for (const item of items) {
            await supabase.from('checklist_items').update({ usecase_id: suggestion.targetOrbitId }).eq('id', item.id)
          }
        }
        await supabase.from('usecases').update({ closed_at: new Date().toISOString() }).eq('id', suggestion.orbitId)
      }
      dismiss(suggestion)
    } catch (err) {
      console.error('Apply suggestion error:', err)
    }
    setApplying(null)
  }

  const dismiss = (suggestion) => {
    setDismissed(prev => new Set([...prev, suggestion.type + (suggestion.taskLabel || '') + (suggestion.orbitId || '')]))
  }

  const suggestionKey = (s) => s.type + (s.taskLabel || '') + (s.orbitId || '')
  const activeSuggestions = (result?.suggestions || []).filter(s => !dismissed.has(suggestionKey(s)))

  const healthColor = (score) => score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  const s = {
    overlay: { position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 },
    box: { background: colors.bgCard, border: `1px solid ${colors.borderLight}`, borderRadius: 24, width: '100%', maxWidth: 520, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    header: { padding: '20px 24px 16px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 },
    title: { fontFamily: 'Nunito, sans-serif', fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 2 },
    subtitle: { fontSize: 12, color: colors.textDim },
    closeBtn: { background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 },
    body: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
    card: { border: `1px solid ${colors.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10, background: colors.bg },
    applyBtn: { background: colors.accentGradient, border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' },
    dismissBtn: { background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '7px 12px', color: colors.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' },
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={s.title}>Organize ✦</div>
              <div style={s.subtitle}>AI-powered suggestions based on your completion history</div>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={s.body}>
          {phase === 'loading' && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 14, color: colors.textDim, lineHeight: 1.6 }}>
                Analyzing 90 days of completion data<br />across all your orbits…
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 14, color: colors.textDim, marginBottom: 20 }}>Couldn't get AI suggestions right now.</div>
              <button onClick={analyze} style={s.applyBtn}>Try again</button>
            </div>
          )}

          {phase === 'ready' && result && (
            <>
              {/* Health score */}
              <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 32, fontWeight: 900, color: healthColor(result.healthScore), lineHeight: 1 }}>
                    {result.healthScore}
                  </div>
                  <div style={{ fontSize: 10, color: colors.textDim, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>Health</div>
                </div>
                <div style={{ width: 1, height: 40, background: colors.border, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5, fontStyle: 'italic' }}>
                  {result.headline}
                </div>
              </div>

              {activeSuggestions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, fontFamily: 'Nunito, sans-serif', marginBottom: 4 }}>All suggestions handled!</div>
                  <div style={{ fontSize: 12, color: colors.textDim }}>Your orbits are looking good.</div>
                </div>
              )}

              {activeSuggestions.map((suggestion, i) => {
                const key = suggestionKey(suggestion)
                const isApplying = applying === key
                const canApply = ['remove_task', 'change_frequency', 'pause_orbit', 'merge_orbits'].includes(suggestion.type)

                return (
                  <div key={key} style={{ ...s.card, borderColor: suggestion.type === 'spotlight' ? colors.accent + '44' : colors.border }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{TYPE_ICONS[suggestion.type]}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: colors.textDim, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3, fontWeight: 700 }}>
                          {TYPE_LABELS[suggestion.type]}
                          {suggestion.orbitName && (
                            <span style={{ color: colors.textMuted, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}> · {suggestion.orbitName}</span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 6 }}>
                          {suggestion.title}
                        </div>
                        <div style={{ fontSize: 12, color: colors.textDim, lineHeight: 1.5, marginBottom: 4 }}>
                          {suggestion.reason}
                        </div>
                        {suggestion.impact && (
                          <div style={{ fontSize: 11, color: colors.accent, fontWeight: 600, marginTop: 4 }}>
                            ✦ {suggestion.impact}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button style={s.dismissBtn} onClick={() => dismiss(suggestion)}>
                        Dismiss
                      </button>
                      {canApply && (
                        <button
                          style={{ ...s.applyBtn, opacity: isApplying ? 0.6 : 1, cursor: isApplying ? 'not-allowed' : 'pointer' }}
                          onClick={() => !isApplying && applySuggestion(suggestion)}
                          disabled={isApplying}
                        >
                          {isApplying ? 'Applying…' : 'Apply'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  onClick={analyze}
                  style={{ background: 'none', border: 'none', color: colors.textDim, fontSize: 12, cursor: 'pointer', padding: '8px 0' }}
                >
                  ↻ Re-analyze
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
