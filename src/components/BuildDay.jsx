import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import { calculateStreak } from '../lib/streaks'
import { playCheckSound, playLogSound } from '../lib/sounds'

export default function BuildDay({ orbits, userId, onClose, onPlanSaved }) {
  const { colors } = useTheme()

  // phase: 'pick' | 'plan' | 'complete'
  const [phase, setPhase] = useState('pick')
  const [orbitsWithTasks, setOrbitsWithTasks] = useState(null)
  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [expandedOrbits, setExpandedOrbits] = useState(new Set())
  const [sideQuests, setSideQuests] = useState([])
  const [selectedQuests, setSelectedQuests] = useState(new Set())
  const [questsExpanded, setQuestsExpanded] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planItems, setPlanItems] = useState({})
  const [dayEntries, setDayEntries] = useState({})
  const [saving, setSaving] = useState({})

  const today = new Date().toISOString().split('T')[0]
  const todayDayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]

  useEffect(() => { fetchTodayData() }, [])

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
      .from('checklist_items').select('*').in('usecase_id', orbitIds)

    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const { data: allEntries } = await supabase
      .from('checkin_entries')
      .select('*, checklist_items(usecase_id)')
      .eq('user_id', userId)
      .gte('date', sixtyDaysAgo.toISOString().split('T')[0])

    const todayDoneIds = new Set(
      (allEntries || []).filter(e => e.date === today && e.value && e.value !== '' && e.value !== 'false')
        .map(e => e.checklist_item_id)
    )

    const enriched = orbits.map(orbit => {
      const orbitItems = (allItems || []).filter(i => i.usecase_id === orbit.id)
      const todayItems = orbitItems.filter(i => isScheduledToday(i.frequency))

      const tasksWithStreaks = todayItems.map(item => {
        const itemEntries = (allEntries || [])
          .filter(e => e.checklist_item_id === item.id)
          .map(e => ({ date: e.date, value: e.value }))
        const streak = calculateStreak(itemEntries, item.frequency)
        return { ...item, streak, checkedToday: todayDoneIds.has(item.id) }
      })

      const anyAtRisk = tasksWithStreaks.some(t => t.streak.atRisk)
      const bestStreak = Math.max(0, ...tasksWithStreaks.map(t => t.streak.current))

      return { ...orbit, tasks: tasksWithStreaks, atRisk: anyAtRisk, bestStreak }
    }).filter(o => o.tasks.length > 0)

    setOrbitsWithTasks(enriched)

    // Fetch active side quests
    const { data: quests } = await supabase
      .from('side_quests')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
    setSideQuests(quests || [])

    // Smart pre-selection: at-risk streaks first, then high-streak incomplete tasks
    const preSelected = new Set()
    for (const orbit of enriched) {
      for (const task of orbit.tasks) {
        if (task.checkedToday) continue
        if (task.streak.atRisk || (task.streak.current >= 3)) {
          preSelected.add(task.id)
        }
      }
    }
    // Cap at 8 pre-selected
    const capped = new Set([...preSelected].slice(0, 8))
    setSelectedTasks(capped)

    // Auto-expand orbits that have pre-selected tasks or are at-risk
    const autoExpand = new Set(
      enriched.filter(o => o.atRisk || o.tasks.some(t => capped.has(t.id))).map(o => o.id)
    )
    // If nothing auto-expands, expand first orbit
    if (autoExpand.size === 0 && enriched.length > 0) autoExpand.add(enriched[0].id)
    setExpandedOrbits(autoExpand)
  }

  const toggleTask = (taskId) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      next.has(taskId) ? next.delete(taskId) : next.add(taskId)
      return next
    })
  }

  const toggleOrbit = (orbitId) => {
    setExpandedOrbits(prev => {
      const next = new Set(prev)
      next.has(orbitId) ? next.delete(orbitId) : next.add(orbitId)
      return next
    })
  }

  const selectAllOrbit = (orbit, e) => {
    e.stopPropagation()
    const ids = orbit.tasks.filter(t => !t.checkedToday).map(t => t.id)
    const allSelected = ids.every(id => selectedTasks.has(id))
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const toggleQuest = (questId) => {
    setSelectedQuests(prev => {
      const next = new Set(prev)
      next.has(questId) ? next.delete(questId) : next.add(questId)
      return next
    })
  }

  const lockInPlan = () => {
    if (!orbitsWithTasks || (selectedTasks.size === 0 && selectedQuests.size === 0)) return

    const builtPlan = orbitsWithTasks.map(orbit => {
      const chosenTasks = orbit.tasks.filter(t => selectedTasks.has(t.id))
      if (chosenTasks.length === 0) return null
      return {
        orbitId: orbit.id,
        orbitName: orbit.name,
        orbitIcon: orbit.icon,
        priority: orbit.atRisk ? 'high' : 'medium',
        tasks: chosenTasks.map(t => t.label),
        reason: orbit.atRisk ? 'Streak at risk — don\'t break it today' : 'Keep the momentum going',
      }
    }).filter(Boolean)

    const items = {}
    for (const planOrbit of builtPlan) {
      if (planOrbit.orbitId === '__sidequests__') continue
      const orbitData = orbitsWithTasks.find(o => o.id === planOrbit.orbitId)
      items[planOrbit.orbitId] = orbitData.tasks.filter(t => selectedTasks.has(t.id))
    }

    const initial = {}
    for (const orbit of orbitsWithTasks) {
      for (const task of orbit.tasks) {
        if (task.checkedToday) initial[task.id] = task.value_type === 'checkbox' ? 'true' : '1'
      }
    }

    // Add side quests as a special plan entry
    const chosenQuests = sideQuests.filter(q => selectedQuests.has(q.id))
    if (chosenQuests.length > 0) {
      builtPlan.push({
        orbitId: '__sidequests__',
        orbitName: 'Side Quests',
        orbitIcon: '☄️',
        priority: 'medium',
        tasks: chosenQuests.map(q => q.title),
        reason: 'One-time tasks you picked for today',
        questIds: chosenQuests.map(q => q.id),
      })
      items['__sidequests__'] = chosenQuests.map(q => ({ id: q.id, label: q.title, value_type: 'checkbox', isSideQuest: true }))
    }

    const orbitCount = builtPlan.filter(p => p.orbitId !== '__sidequests__').length
    const questCount = selectedQuests.size
    const taskTotal = selectedTasks.size + questCount
    const summary = [
      taskTotal > 0 ? `${taskTotal} task${taskTotal !== 1 ? 's' : ''}` : '',
      orbitCount > 0 ? `${orbitCount} orbit${orbitCount !== 1 ? 's' : ''}` : '',
      questCount > 0 ? `${questCount} side quest${questCount !== 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' · ')

    setPlan({ plan: builtPlan, greeting: 'Your plan is locked in. Let\'s do this.', summary })
    setPlanItems(items)
    setDayEntries(initial)

    localStorage.setItem(`orbit_today_plan_${userId}`, JSON.stringify({
      date: today, plan: builtPlan, planItems: items,
      greeting: 'Your plan is locked in. Let\'s do this.', summary,
    }))
    onPlanSaved?.()
    setPhase('plan')
  }

  const saveEntry = async (itemId, value, valueType, isSideQuest = false) => {
    setSaving(prev => ({ ...prev, [itemId]: true }))

    if (isSideQuest) {
      // Mark side quest complete in side_quests table
      if (value === true || value === 'true') {
        await supabase.from('side_quests').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', itemId)
      }
    } else {
      await supabase.from('checkin_entries').upsert({
        checklist_item_id: itemId, user_id: userId, date: today, value: String(value),
      }, { onConflict: 'checklist_item_id,user_id,date' })
    }
    const newEntries = { ...dayEntries, [itemId]: String(value) }
    setDayEntries(newEntries)
    setSaving(prev => ({ ...prev, [itemId]: false }))
    valueType === 'checkbox' ? playCheckSound() : playLogSound()
    try {
      const raw = localStorage.getItem(`orbit_today_plan_${userId}`)
      if (raw) {
        const stored = JSON.parse(raw)
        stored.entries = { ...(stored.entries || {}), [itemId]: String(value) }
        localStorage.setItem(`orbit_today_plan_${userId}`, JSON.stringify(stored))
      }
    } catch {}
    const allIds = Object.values(planItems).flat().map(i => i.id)
    const doneCount = allIds.filter(id => {
      const v = id === itemId ? String(value) : newEntries[id]
      return v && v !== '' && v !== 'false'
    }).length
    if (doneCount === allIds.length && allIds.length > 0) setTimeout(() => setPhase('complete'), 600)
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 },
    box: { background: colors.bgCard, border: `1px solid ${colors.borderLight}`, borderRadius: 24, width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    header: { padding: '20px 24px 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 },
    title: { fontFamily: 'Nunito, sans-serif', fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 2 },
    subtitle: { fontSize: 12, color: colors.textDim },
    closeBtn: { background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 },
    body: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
    footer: { padding: '14px 20px', borderTop: `1px solid ${colors.border}`, flexShrink: 0 },
    lockBtn: { width: '100%', background: colors.accentGradient, border: 'none', borderRadius: 14, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', transition: 'opacity 0.2s' },
  }

  // ── Complete ──────────────────────────────────────────────────────
  if (phase === 'complete') return (
    <div style={s.overlay}>
      <div style={{ ...s.box, alignItems: 'center', justifyContent: 'center', padding: '48px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>🎉</div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 24, fontWeight: 800, color: colors.text, marginBottom: 8 }}>Day Complete!</div>
        <div style={{ fontSize: 14, color: colors.textDim, lineHeight: 1.6, marginBottom: 28 }}>
          You showed up for every task in today's plan.<br />Streaks building. Keep the momentum.
        </div>
        <button style={{ ...s.lockBtn, maxWidth: 200 }} onClick={onClose}>Done 🔥</button>
        <style>{`@keyframes popIn { 0% { transform:scale(0.3);opacity:0; } 60% { transform:scale(1.15); } 100% { transform:scale(1);opacity:1; } }`}</style>
      </div>
    </div>
  )

  // ── Plan (check-in mode) ──────────────────────────────────────────
  if (phase === 'plan' && plan) {
    const allPlanIds = Object.values(planItems).flat().map(i => i.id)
    const doneCount = allPlanIds.filter(id => { const v = dayEntries[id]; return v && v !== '' && v !== 'false' }).length
    const progress = allPlanIds.length > 0 ? Math.round((doneCount / allPlanIds.length) * 100) : 0
    const PCOLS = { high: { bg: '#22c55e18', border: '#22c55e44', label: '#22c55e' }, medium: { bg: colors.accent + '12', border: colors.accent + '44', label: colors.accent } }

    return (
      <div style={s.overlay} onClick={onClose}>
        <div style={s.box} onClick={e => e.stopPropagation()}>
          <div style={s.header}>
            <div>
              <div style={s.title}>Today's Plan 🎯</div>
              <div style={{ ...s.subtitle, color: colors.accent }}>{plan.summary}</div>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div style={{ padding: '8px 20px 0', flexShrink: 0 }}>
            <div style={{ background: colors.border, borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#22c55e' : colors.accentGradient, borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: colors.textDim, marginTop: 5, textAlign: 'right' }}>{doneCount}/{allPlanIds.length} done</div>
          </div>

          <div style={s.body}>
            {plan.plan?.map(planOrbit => {
              const pc = PCOLS[planOrbit.priority] || PCOLS.medium
              const items = planItems[planOrbit.orbitId] || []
              const orbitDone = items.length > 0 && items.every(item => { const v = dayEntries[item.id]; return v && v !== '' && v !== 'false' })

              return (
                <div key={planOrbit.orbitId} style={{ borderRadius: 14, padding: '14px 16px', marginBottom: 10, background: orbitDone ? '#22c55e0a' : pc.bg, border: `1.5px solid ${orbitDone ? '#22c55e33' : pc.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>{planOrbit.orbitIcon}</span>
                    <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: colors.text, flex: 1 }}>{planOrbit.orbitName}</span>
                    {orbitDone
                      ? <span style={{ fontSize: 11, fontWeight: 700, background: '#22c55e22', color: '#22c55e', padding: '2px 8px', borderRadius: 10 }}>✓ Done</span>
                      : planOrbit.priority === 'high' && <span style={{ fontSize: 11, fontWeight: 700, background: pc.label + '22', color: pc.label, padding: '2px 8px', borderRadius: 10 }}>Streak at risk</span>}
                  </div>
                  {items.map(item => {
                    const val = dayEntries[item.id]
                    const done = val && val !== '' && val !== 'false'
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ flex: 1, fontSize: 13, color: done ? colors.textDim : colors.text, textDecoration: done ? 'line-through' : 'none' }}>{item.label}</div>
                        {saving[item.id] && <span style={{ fontSize: 10, color: colors.accent }}>•••</span>}
                        {item.value_type === 'checkbox' && (
                          <button onClick={() => saveEntry(item.id, !done, 'checkbox', item.isSideQuest)} style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${done ? '#22c55e' : pc.label}`, background: done ? '#22c55e' : 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>{done ? '✓' : ''}</button>
                        )}
                        {item.value_type === 'score' && (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <button key={n} onClick={() => saveEntry(item.id, n, 'score')} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${Number(val) === n ? pc.label : colors.border}`, background: Number(val) === n ? pc.label : 'transparent', color: Number(val) === n ? '#fff' : colors.textDim, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                            ))}
                          </div>
                        )}
                        {item.value_type === 'number' && (
                          <input style={{ width: 60, background: colors.bgInput, border: `1px solid ${colors.border}`, borderRadius: 7, padding: '5px 8px', color: colors.text, fontSize: 13, outline: 'none', textAlign: 'center' }} type="number" placeholder="0" defaultValue={val || ''} key={item.id + (val ?? '')} onBlur={e => { if (e.target.value) saveEntry(item.id, e.target.value, 'number') }} onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div style={s.footer}>
            <button style={{ ...s.lockBtn, background: 'none', border: `1px solid ${colors.border}`, color: colors.textDim, fontSize: 13, padding: '11px' }} onClick={() => setPhase('pick')}>
              ← Edit my picks
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Pick phase ────────────────────────────────────────────────────
  const totalSelected = selectedTasks.size
  const loading = !orbitsWithTasks

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <div style={s.title}>Plan My Day 🗓️</div>
            <div style={s.subtitle}>
              Tap tasks to pick what you'll do today — pre-selected based on streaks
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textDim }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              Loading your tasks...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            orbitsWithTasks.map(orbit => {
              const orbitSelectedCount = orbit.tasks.filter(t => selectedTasks.has(t.id)).length
              const isExpanded = expandedOrbits.has(orbit.id)
              const allTaskIds = orbit.tasks.filter(t => !t.checkedToday).map(t => t.id)
              const allSelected = allTaskIds.length > 0 && allTaskIds.every(id => selectedTasks.has(id))

              return (
                <div key={orbit.id} style={{ marginBottom: 8, border: `1px solid ${orbit.atRisk ? '#f59e0b55' : colors.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                  {/* Orbit header — click to expand/collapse */}
                  <div
                    onClick={() => toggleOrbit(orbit.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', background: isExpanded ? colors.bg : colors.bgCard, userSelect: 'none' }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{orbit.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: colors.text }}>{orbit.name}</div>
                      <div style={{ fontSize: 11, color: colors.textDim, marginTop: 1 }}>
                        {orbit.tasks.length} task{orbit.tasks.length !== 1 ? 's' : ''} today
                        {orbit.atRisk && <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠️ streak at risk</span>}
                        {orbit.bestStreak > 0 && !orbit.atRisk && <span style={{ color: '#22c55e', marginLeft: 8 }}>🔥 {orbit.bestStreak} day streak</span>}
                      </div>
                    </div>
                    {orbitSelectedCount > 0 && (
                      <span style={{ background: colors.accent, color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>
                        {orbitSelectedCount} picked
                      </span>
                    )}
                    {isExpanded && allTaskIds.length > 1 && (
                      <button
                        onClick={e => selectAllOrbit(orbit, e)}
                        style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: 6, padding: '3px 8px', color: colors.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', flexShrink: 0 }}
                      >
                        {allSelected ? 'Clear' : 'All'}
                      </button>
                    )}
                    <span style={{ color: colors.textDim, fontSize: 14, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
                  </div>

                  {/* Task list */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${colors.border}` }}>
                      {orbit.tasks.map(task => {
                        const isSelected = selectedTasks.has(task.id)
                        const alreadyDone = task.checkedToday

                        return (
                          <div
                            key={task.id}
                            onClick={() => !alreadyDone && toggleTask(task.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '11px 14px',
                              borderBottom: `1px solid ${colors.border}`,
                              background: isSelected ? colors.accent + '0d' : 'transparent',
                              cursor: alreadyDone ? 'default' : 'pointer',
                              transition: 'background 0.15s',
                              opacity: alreadyDone ? 0.5 : 1,
                            }}
                          >
                            {/* Select circle */}
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                              border: `2px solid ${alreadyDone ? '#22c55e' : isSelected ? colors.accent : colors.border}`,
                              background: alreadyDone ? '#22c55e' : isSelected ? colors.accent : 'transparent',
                              color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}>
                              {(isSelected || alreadyDone) ? '✓' : ''}
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: alreadyDone ? colors.textDim : colors.text, fontFamily: 'Nunito, sans-serif', fontWeight: 600, textDecoration: alreadyDone ? 'line-through' : 'none' }}>
                                {task.label}
                              </div>
                              <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2, display: 'flex', gap: 8 }}>
                                <span>{task.value_type}</span>
                                {alreadyDone && <span style={{ color: '#22c55e' }}>✓ done today</span>}
                              </div>
                            </div>

                            {task.streak.atRisk && !alreadyDone && (
                              <span style={{ fontSize: 11, background: '#f59e0b22', color: '#f59e0b', padding: '2px 7px', borderRadius: 8, fontWeight: 700, flexShrink: 0 }}>
                                ⚠️ {task.streak.current}d
                              </span>
                            )}
                            {task.streak.current >= 3 && !task.streak.atRisk && !alreadyDone && (
                              <span style={{ fontSize: 11, background: '#22c55e18', color: '#22c55e', padding: '2px 7px', borderRadius: 8, fontWeight: 700, flexShrink: 0 }}>
                                🔥 {task.streak.current}d
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
          {/* Side Quests accordion */}
          {sideQuests.length > 0 && (
            <div style={{ marginTop: 8, border: `1px solid ${colors.accent}44`, borderRadius: 14, overflow: 'hidden' }}>
              <div
                onClick={() => setQuestsExpanded(e => !e)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', background: questsExpanded ? colors.bg : colors.bgCard, userSelect: 'none' }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>☄️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, color: colors.text }}>Side Quests</div>
                  <div style={{ fontSize: 11, color: colors.textDim, marginTop: 1 }}>{sideQuests.length} open · pick any to tackle today</div>
                </div>
                {selectedQuests.size > 0 && (
                  <span style={{ background: colors.accent, color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>
                    {selectedQuests.size} picked
                  </span>
                )}
                <span style={{ color: colors.textDim, fontSize: 14, transition: 'transform 0.2s', transform: questsExpanded ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
              </div>

              {questsExpanded && (
                <div style={{ borderTop: `1px solid ${colors.border}` }}>
                  {sideQuests.map(quest => {
                    const isSelected = selectedQuests.has(quest.id)
                    return (
                      <div
                        key={quest.id}
                        onClick={() => toggleQuest(quest.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: `1px solid ${colors.border}`, background: isSelected ? colors.accent + '0d' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSelected ? colors.accent : colors.border}`, background: isSelected ? colors.accent : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                          {isSelected ? '✓' : ''}
                        </div>
                        <span style={{ flex: 1, fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 600, color: colors.text }}>
                          {quest.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={s.footer}>
          {(totalSelected > 0 || selectedQuests.size > 0) ? (
            <button style={s.lockBtn} onClick={lockInPlan}>
              Lock in {totalSelected + selectedQuests.size} item{(totalSelected + selectedQuests.size) !== 1 ? 's' : ''} →
            </button>
          ) : (
            <button style={{ ...s.lockBtn, opacity: 0.4, cursor: 'not-allowed' }} disabled>
              Tap tasks above to build your plan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
