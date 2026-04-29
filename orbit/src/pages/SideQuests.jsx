import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import Navbar from '../components/Navbar'

export default function SideQuests() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const [quests, setQuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { fetchQuests() }, [user])

  const fetchQuests = async () => {
    const { data } = await supabase
      .from('side_quests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setQuests(data || [])
    setLoading(false)
  }

  const addQuest = async () => {
    const title = newTitle.trim()
    if (!title) return
    setAdding(true)
    const { data, error } = await supabase
      .from('side_quests')
      .insert({ user_id: user.id, title, completed: false })
      .select()
      .single()
    if (!error && data) {
      setQuests(prev => [data, ...prev])
      setNewTitle('')
      inputRef.current?.focus()
    }
    setAdding(false)
  }

  const toggleQuest = async (quest) => {
    const completed = !quest.completed
    const completed_at = completed ? new Date().toISOString() : null
    const { error } = await supabase
      .from('side_quests')
      .update({ completed, completed_at })
      .eq('id', quest.id)
    if (!error) {
      setQuests(prev => prev.map(q => q.id === quest.id ? { ...q, completed, completed_at } : q))
    }
  }

  const deleteQuest = async (id) => {
    await supabase.from('side_quests').delete().eq('id', id)
    setQuests(prev => prev.filter(q => q.id !== id))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addQuest()
  }

  const active = quests.filter(q => !q.completed)
  const done = quests.filter(q => q.completed)

  const s = {
    page: { minHeight: '100vh', background: colors.bg },
    content: { maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px' },
    header: { marginBottom: 32 },
    title: { fontFamily: 'Nunito, sans-serif', fontSize: 28, fontWeight: 800, color: colors.text, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 },
    subtitle: { fontSize: 14, color: colors.textDim, lineHeight: 1.5 },
    addRow: { display: 'flex', gap: 10, marginBottom: 28 },
    input: { flex: 1, background: colors.bgCard, border: `1.5px solid ${colors.border}`, borderRadius: 12, padding: '12px 16px', color: colors.text, fontSize: 15, fontFamily: 'Nunito, sans-serif', outline: 'none' },
    addBtn: { background: colors.accentGradient, border: 'none', borderRadius: 12, padding: '12px 20px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', whiteSpace: 'nowrap', opacity: adding ? 0.7 : 1 },
    emptyState: { textAlign: 'center', padding: '48px 20px', color: colors.textDim },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15, color: colors.textMuted, marginBottom: 6 },
    emptySub: { fontSize: 13, color: colors.textDim },
    questCard: { display: 'flex', alignItems: 'center', gap: 14, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10, transition: 'border-color 0.15s' },
    checkCircle: { width: 22, height: 22, borderRadius: '50%', border: `2px solid`, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, transition: 'all 0.2s' },
    questTitle: { flex: 1, fontSize: 15, fontFamily: 'Nunito, sans-serif', fontWeight: 600, lineHeight: 1.4 },
    deleteBtn: { background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 16, opacity: 0, transition: 'opacity 0.15s', padding: '2px 6px', borderRadius: 6 },
    sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 28 },
    sectionTitle: { fontSize: 12, fontWeight: 700, color: colors.textDim, textTransform: 'uppercase', letterSpacing: '0.7px' },
    toggleBtn: { background: 'none', border: 'none', color: colors.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', display: 'flex', alignItems: 'center', gap: 4 },
  }

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.content}>
        <div style={s.header}>
          <div style={s.title}>
            <span>☄️</span> Side Quests
          </div>
          <div style={s.subtitle}>
            One-time tasks that don't belong to any orbit — buy things, fix stuff, run errands. Check them off, done.
          </div>
        </div>

        {/* Add input */}
        <div style={s.addRow}>
          <input
            ref={inputRef}
            style={s.input}
            placeholder="Add a side quest... (press Enter)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={e => e.target.style.borderColor = colors.accent}
            onBlur={e => e.target.style.borderColor = colors.border}
          />
          <button style={s.addBtn} onClick={addQuest} disabled={adding || !newTitle.trim()}>
            + Add
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textDim }}>Loading...</div>
        ) : active.length === 0 && done.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>☄️</div>
            <div style={s.emptyText}>No side quests yet</div>
            <div style={s.emptySub}>Add one-time tasks that don't fit in your tracked orbits</div>
          </div>
        ) : (
          <>
            {/* Active quests */}
            {active.length > 0 && (
              <>
                {done.length > 0 && (
                  <div style={s.sectionHeader}>
                    <span style={s.sectionTitle}>To do · {active.length}</span>
                  </div>
                )}
                {active.map(quest => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    colors={colors}
                    s={s}
                    onToggle={toggleQuest}
                    onDelete={deleteQuest}
                  />
                ))}
              </>
            )}

            {active.length === 0 && done.length > 0 && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: colors.textDim }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.textMuted }}>All caught up!</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Every side quest is done.</div>
              </div>
            )}

            {/* Done section */}
            {done.length > 0 && (
              <>
                <div style={s.sectionHeader}>
                  <span style={s.sectionTitle}>Done · {done.length}</span>
                  <button style={s.toggleBtn} onClick={() => setShowDone(!showDone)}>
                    {showDone ? '▴ Hide' : '▾ Show'}
                  </button>
                </div>
                {showDone && done.map(quest => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    colors={colors}
                    s={s}
                    onToggle={toggleQuest}
                    onDelete={deleteQuest}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function QuestCard({ quest, colors, s, onToggle, onDelete }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        ...s.questCard,
        borderColor: hovered ? colors.borderLight : colors.border,
        opacity: quest.completed ? 0.6 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          ...s.checkCircle,
          borderColor: quest.completed ? '#22c55e' : colors.border,
          background: quest.completed ? '#22c55e' : 'transparent',
          color: '#fff',
        }}
        onClick={() => onToggle(quest)}
      >
        {quest.completed ? '✓' : ''}
      </div>

      <span style={{
        ...s.questTitle,
        color: quest.completed ? colors.textDim : colors.text,
        textDecoration: quest.completed ? 'line-through' : 'none',
      }}>
        {quest.title}
      </span>

      <button
        style={{ ...s.deleteBtn, opacity: hovered ? 0.6 : 0 }}
        onClick={() => onDelete(quest.id)}
        title="Delete"
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ff6b6b' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = hovered ? '0.6' : '0'; e.currentTarget.style.color = colors.textDim }}
      >
        ✕
      </button>
    </div>
  )
}
