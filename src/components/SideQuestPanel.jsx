import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const CELEBRATE = ['🎉', '✨', '🚀', '⚡', '🏆', '🌟', '💥', '🎯', '🔥', '👏']

function randomCelebrate() {
  return CELEBRATE[Math.floor(Math.random() * CELEBRATE.length)]
}

export default function SideQuestPanel() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [quests, setQuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [celebration, setCelebration] = useState(null) // { id, emoji }
  const [firstLoad, setFirstLoad] = useState(true)
  const [draggedQuest, setDraggedQuest] = useState(null)
  const [dragOverQuest, setDragOverQuest] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (user) fetchQuests()
  }, [user])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('openSideQuests', handler)
    return () => window.removeEventListener('openSideQuests', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  const fetchQuests = async () => {
    const { data } = await supabase
      .from('side_quests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setQuests(data || [])
    setLoading(false)
    setFirstLoad(false)
  }

  const addQuest = async () => {
    const title = newTitle.trim()
    if (!title) return
    const { data, error } = await supabase
      .from('side_quests')
      .insert({ user_id: user.id, title, completed: false })
      .select()
      .single()
    if (!error && data) {
      setQuests(prev => [data, ...prev])
      setNewTitle('')
    }
  }

  const handleDragStart = (quest) => setDraggedQuest(quest)

  const handleDragOver = (e, quest) => {
    e.preventDefault()
    if (!draggedQuest || draggedQuest.id === quest.id) return
    setDragOverQuest(quest.id)
  }

  const handleDrop = async (e, targetQuest) => {
    e.preventDefault()
    if (!draggedQuest || draggedQuest.id === targetQuest.id) return

    // Only reorder within active quests
    const active = quests.filter(q => !q.completed)
    const rest = quests.filter(q => q.completed)
    const fromIdx = active.findIndex(q => q.id === draggedQuest.id)
    const toIdx = active.findIndex(q => q.id === targetQuest.id)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...active]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, draggedQuest)

    setQuests([...reordered, ...rest])
    setDraggedQuest(null)
    setDragOverQuest(null)

    // Persist sort_order (silently skip if column doesn't exist yet)
    try {
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('side_quests').update({ sort_order: i }).eq('id', reordered[i].id)
      }
    } catch {}
  }

  const handleDragEnd = () => {
    setDraggedQuest(null)
    setDragOverQuest(null)
  }

  const toggleQuest = async (quest) => {
    const completed = !quest.completed
    const completed_at = completed ? new Date().toISOString() : null
    await supabase.from('side_quests').update({ completed, completed_at }).eq('id', quest.id)
    setQuests(prev => prev.map(q => q.id === quest.id ? { ...q, completed, completed_at } : q))
    if (completed) {
      const emoji = randomCelebrate()
      setCelebration({ id: quest.id, emoji })
      setTimeout(() => setCelebration(null), 1800)
    }
  }

  const deleteQuest = async (id) => {
    await supabase.from('side_quests').delete().eq('id', id)
    setQuests(prev => prev.filter(q => q.id !== id))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addQuest()
    if (e.key === 'Escape') setOpen(false)
  }

  const active = quests.filter(q => !q.completed)
  const done = quests.filter(q => q.completed)
  const isEmpty = !loading && quests.length === 0

  return (
    <>
      <style>{`
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes questPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes celebFloat {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 1; transform: translateY(-18px) scale(1.3); }
          100% { opacity: 0; transform: translateY(-32px) scale(0.9); }
        }
        @keyframes tabPulse {
          0%, 100% { box-shadow: -2px 0 12px rgba(108,99,255,0.15); }
          50%       { box-shadow: -2px 0 20px rgba(108,99,255,0.4); }
        }
      `}</style>

      {/* Celebration overlay */}
      {celebration && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 72,
            animation: 'celebFloat 1.8s ease forwards',
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
          }}>
            {celebration.emoji}
          </div>
        </div>
      )}

      {/* Slide-out tab (always visible) */}
      <div style={{
        position: 'fixed',
        right: open ? 300 : 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 900,
        transition: 'right 0.3s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            background: open ? colors.accent : colors.bgCard,
            border: `1px solid ${open ? colors.accent : colors.border}`,
            borderRight: 'none',
            borderRadius: '10px 0 0 10px',
            padding: '16px 10px',
            color: open ? '#fff' : colors.textMuted,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'Nunito, sans-serif',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            userSelect: 'none',
            animation: !open && active.length > 0 ? 'tabPulse 2.5s ease infinite' : 'none',
            transition: 'background 0.2s, color 0.2s',
          }}
          title={open ? 'Close Side Quests' : 'Open Side Quests'}
        >
          <span style={{ writingMode: 'horizontal-tb', fontSize: 16 }}>☄️</span>
          <span>Side Quests</span>
          {active.length > 0 && (
            <span style={{
              writingMode: 'horizontal-tb',
              background: open ? 'rgba(255,255,255,0.3)' : colors.accent,
              color: '#fff',
              borderRadius: '50%',
              width: 18, height: 18,
              fontSize: 10,
              fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {active.length}
            </span>
          )}
        </button>
      </div>

      {/* The panel */}
      {open && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 300,
          background: colors.bgCard,
          borderLeft: `1px solid ${colors.border}`,
          zIndex: 890,
          display: 'flex',
          flexDirection: 'column',
          animation: 'panelSlideIn 0.25s ease',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.3)',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 18px 14px',
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 16, fontWeight: 800, color: colors.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ☄️ Side Quests
                </div>
                <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>
                  {active.length > 0 ? `${active.length} open · ${done.length} done` : done.length > 0 ? `All ${done.length} done!` : 'One-time tasks'}
                </div>
              </div>
            </div>

            {/* Add input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                style={{
                  flex: 1,
                  background: colors.bg,
                  border: `1.5px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: colors.text,
                  fontSize: 13,
                  fontFamily: 'Nunito, sans-serif',
                  outline: 'none',
                }}
                placeholder={isEmpty ? 'e.g. Search for a new house...' : 'Add a task... (Enter)'}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={e => e.target.style.borderColor = colors.accent}
                onBlur={e => e.target.style.borderColor = colors.border}
              />
              <button
                onClick={addQuest}
                disabled={!newTitle.trim()}
                style={{
                  background: colors.accent,
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 14px',
                  color: '#fff',
                  fontSize: 18,
                  cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
                  opacity: newTitle.trim() ? 1 : 0.4,
                  transition: 'opacity 0.15s',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >+</button>
            </div>
          </div>

          {/* Quest list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

            {/* First-timer onboarding */}
            {isEmpty && (
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  background: `linear-gradient(135deg, ${colors.accent}12, ${colors.accent}06)`,
                  border: `1px solid ${colors.accent}33`,
                  borderRadius: 14,
                  padding: '16px 14px 14px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, fontFamily: 'Nunito, sans-serif', marginBottom: 6, lineHeight: 1.5 }}>
                    Got a one-time task to track?
                  </div>
                  <div style={{ fontSize: 12, color: colors.textDim, lineHeight: 1.6, marginBottom: 12 }}>
                    Things like <em style={{ color: colors.textMuted }}>"search for a new house"</em> or <em style={{ color: colors.textMuted }}>"fix the fire alarm battery"</em> — not daily habits, just things you need to get done once.
                  </div>
                  <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tap to try one →
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      ['🏠', 'Search for a new house'],
                      ['🛒', 'Buy a new laptop charger'],
                      ['🔋', 'Fix smoke alarm battery'],
                      ['📞', 'Call insurance company'],
                    ].map(([icon, text]) => (
                      <button
                        key={text}
                        onClick={() => { setNewTitle(text); inputRef.current?.focus() }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: colors.bgCard,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8, padding: '8px 10px',
                          fontSize: 12, color: colors.textMuted,
                          cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'Nunito, sans-serif',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent + '88'; e.currentTarget.style.color = colors.text }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textMuted }}
                      >
                        <span>{icon}</span>
                        <span>{text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Active quests */}
            {active.map(quest => (
              <QuestRow
                key={quest.id}
                quest={quest}
                colors={colors}
                isCelebrating={celebration?.id === quest.id}
                celebrationEmoji={celebration?.emoji}
                isDragOver={dragOverQuest === quest.id}
                isDragging={draggedQuest?.id === quest.id}
                onToggle={toggleQuest}
                onDelete={deleteQuest}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
            {active.length >= 2 && !draggedQuest && (
              <div style={{ textAlign: 'center', fontSize: 11, color: colors.textDim, opacity: 0.5, marginTop: 2, userSelect: 'none' }}>
                ⠿ drag to reorder
              </div>
            )}

            {/* All-done celebration */}
            {active.length === 0 && done.length > 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, fontFamily: 'Nunito, sans-serif' }}>All caught up!</div>
                <div style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>Quest log is clear. Nice work.</div>
              </div>
            )}

            {/* Done section */}
            {done.length > 0 && (
              <div style={{ marginTop: active.length > 0 ? 20 : 12 }}>
                <button
                  onClick={() => setShowDone(!showDone)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '4px 0', marginBottom: 8,
                    color: colors.textDim, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.6px',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showDone ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
                  Done · {done.length}
                </button>
                {showDone && done.map(quest => (
                  <QuestRow
                    key={quest.id}
                    quest={quest}
                    colors={colors}
                    isCelebrating={false}
                    onToggle={toggleQuest}
                    onDelete={deleteQuest}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function QuestRow({ quest, colors, isCelebrating, celebrationEmoji, isDragOver, isDragging, onToggle, onDelete, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      draggable={!quest.completed}
      onDragStart={() => onDragStart(quest)}
      onDragOver={e => onDragOver(e, quest)}
      onDrop={e => onDrop(e, quest)}
      onDragEnd={onDragEnd}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 10px',
        borderRadius: 10,
        marginBottom: 6,
        background: isCelebrating ? `linear-gradient(135deg, #22c55e18, #22c55e08)` : colors.bg,
        border: `1px solid ${isCelebrating ? '#22c55e55' : isDragOver ? colors.accent + 'aa' : hovered ? colors.borderLight : colors.border}`,
        borderTopWidth: isDragOver ? 3 : 1,
        opacity: isDragging ? 0.4 : quest.completed ? 0.65 : 1,
        transition: 'border-color 0.15s, background 0.2s, opacity 0.2s',
        animation: isCelebrating ? 'questPop 0.4s ease' : 'none',
        cursor: quest.completed ? 'default' : 'auto',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Floating celebration emoji */}
      {isCelebrating && celebrationEmoji && (
        <div style={{
          position: 'absolute',
          top: -4, left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 22,
          animation: 'celebFloat 1.8s ease forwards',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {celebrationEmoji}
        </div>
      )}

      {/* Drag handle — only for active quests */}
      {!quest.completed && (
        <div
          style={{
            fontSize: 12, color: colors.textDim, cursor: 'grab',
            opacity: hovered ? 0.7 : 0.25, transition: 'opacity 0.15s',
            userSelect: 'none', flexShrink: 0, letterSpacing: '1px', lineHeight: 1,
            padding: '2px 1px',
          }}
          title="Drag to reorder"
        >⠿</div>
      )}

      {/* Check button */}
      <div
        onClick={() => onToggle(quest)}
        style={{
          width: 20, height: 20,
          borderRadius: '50%',
          border: `2px solid ${quest.completed ? '#22c55e' : colors.border}`,
          background: quest.completed ? '#22c55e' : 'transparent',
          color: '#fff',
          fontSize: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
      >
        {quest.completed ? '✓' : ''}
      </div>

      {/* Title */}
      <span style={{
        flex: 1,
        fontSize: 13,
        fontFamily: 'Nunito, sans-serif',
        fontWeight: 600,
        color: quest.completed ? colors.textDim : colors.text,
        textDecoration: quest.completed ? 'line-through' : 'none',
        lineHeight: 1.4,
        wordBreak: 'break-word',
      }}>
        {quest.title}
      </span>

      {/* Delete */}
      <button
        onClick={() => onDelete(quest.id)}
        style={{
          background: 'none', border: 'none',
          color: colors.textDim,
          cursor: 'pointer',
          fontSize: 13,
          opacity: hovered ? 0.7 : 0,
          transition: 'opacity 0.15s',
          padding: '2px 4px',
          borderRadius: 4,
          flexShrink: 0,
          lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ff6b6b' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = hovered ? '0.7' : '0'; e.currentTarget.style.color = colors.textDim }}
      >✕</button>
    </div>
  )
}
