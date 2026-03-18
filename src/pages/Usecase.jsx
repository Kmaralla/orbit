import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import Navbar from '../components/Navbar'

const VALUE_TYPES = [
  { key: 'checkbox', label: 'Done / Not Done', icon: '☑️' },
  { key: 'score', label: 'Score (1–10)', icon: '⭐' },
  { key: 'number', label: 'Number / Count', icon: '🔢' },
  { key: 'text', label: 'Text / Notes', icon: '📝' },
]

const FREQUENCIES = [
  { key: 'daily', label: 'Daily', desc: 'Every day' },
  { key: 'weekdays', label: 'Weekdays', desc: 'Mon–Fri' },
  { key: 'weekly', label: 'Weekly', desc: 'Once/week' },
  { key: 'custom', label: 'Custom', desc: 'Pick days' },
]

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'M', full: 'Monday' },
  { key: 'tue', label: 'T', full: 'Tuesday' },
  { key: 'wed', label: 'W', full: 'Wednesday' },
  { key: 'thu', label: 'T', full: 'Thursday' },
  { key: 'fri', label: 'F', full: 'Friday' },
  { key: 'sat', label: 'S', full: 'Saturday' },
  { key: 'sun', label: 'S', full: 'Sunday' },
]

export default function Usecase() {
  const { id } = useParams()
  const { user } = useAuth()
  const { colors } = useTheme()
  const navigate = useNavigate()
  const [usecase, setUsecase] = useState(null)
  const [items, setItems] = useState([])
  const [todayEntries, setTodayEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [showAddItem, setShowAddItem] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [newItem, setNewItem] = useState({ label: '', value_type: 'checkbox', frequency: 'daily', customDays: [], description: '' })
  const [draggedItem, setDraggedItem] = useState(null)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const { data: uc } = await supabase.from('usecases').select('*').eq('id', id).single()
    setUsecase(uc)

    const { data: its } = await supabase.from('checklist_items').select('*').eq('usecase_id', id).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at')
    setItems(its || [])

    const { data: entries } = await supabase
      .from('checkin_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .in('checklist_item_id', (its || []).map(i => i.id))

    const map = {}
    entries?.forEach(e => { map[e.checklist_item_id] = e })
    setTodayEntries(map)
    setLoading(false)
  }

  const saveEntry = async (itemId, value) => {
    setSaving(prev => ({ ...prev, [itemId]: true }))
    const existing = todayEntries[itemId]

    if (existing) {
      await supabase.from('checkin_entries').update({ value: String(value) }).eq('id', existing.id)
    } else {
      await supabase.from('checkin_entries').insert({
        checklist_item_id: itemId,
        user_id: user.id,
        date: today,
        value: String(value)
      })
    }

    setTodayEntries(prev => ({ ...prev, [itemId]: { ...prev[itemId], checklist_item_id: itemId, value: String(value) } }))
    setSaving(prev => ({ ...prev, [itemId]: false }))
  }

  const toggleCustomDay = (day) => {
    setNewItem(prev => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter(d => d !== day)
        : [...prev.customDays, day]
    }))
  }

  const addItem = async () => {
    if (!newItem.label.trim()) return
    // For custom frequency, store days as comma-separated string like "custom:mon,wed,fri"
    const frequencyValue = newItem.frequency === 'custom' && newItem.customDays.length > 0
      ? `custom:${newItem.customDays.join(',')}`
      : newItem.frequency

    const { data } = await supabase.from('checklist_items').insert({
      usecase_id: id,
      label: newItem.label,
      value_type: newItem.value_type,
      frequency: frequencyValue,
      description: newItem.description
    }).select().single()
    if (data) {
      setItems(prev => [...prev, data])
      setNewItem({ label: '', value_type: 'checkbox', frequency: 'daily', customDays: [], description: '' })
      setShowAddItem(false)
    }
  }

  const deleteItem = async (itemId) => {
    await supabase.from('checklist_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  const updateItem = async (itemId, updates) => {
    await supabase.from('checklist_items').update(updates).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i))
    setEditingItem(null)
  }

  // Drag and drop reordering
  const handleDragStart = (e, item) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, targetItem) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetItem.id) return
  }

  const handleDrop = async (e, targetItem) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetItem.id) return

    const newItems = [...items]
    const draggedIndex = newItems.findIndex(i => i.id === draggedItem.id)
    const targetIndex = newItems.findIndex(i => i.id === targetItem.id)

    // Reorder locally
    newItems.splice(draggedIndex, 1)
    newItems.splice(targetIndex, 0, draggedItem)
    setItems(newItems)

    // Update sort_order in database
    for (let i = 0; i < newItems.length; i++) {
      await supabase.from('checklist_items').update({ sort_order: i }).eq('id', newItems[i].id)
    }

    setDraggedItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const completedCount = items.filter(i => todayEntries[i.id]?.value !== undefined && todayEntries[i.id]?.value !== '').length
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0

  const s = {
    page: { minHeight: '100vh', background: colors.bg },
    content: { maxWidth: 800, margin: '0 auto', padding: '40px 24px' },
    back: { background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: 14, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Nunito, sans-serif' },
    header: { marginBottom: 36 },
    ucTitle: { fontFamily: 'Nunito, sans-serif', fontSize: 32, fontWeight: 800, color: colors.text, letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 },
    progressBar: { background: colors.border, borderRadius: 8, height: 6, marginTop: 16, overflow: 'hidden' },
    progressFill: { height: '100%', background: colors.accentGradient, borderRadius: 8, transition: 'width 0.5s ease' },
    progressText: { fontSize: 13, color: colors.textDim, marginTop: 8 },
    dateLabel: { fontSize: 13, color: colors.accent, marginBottom: 24, fontFamily: 'Nunito, sans-serif' },
    itemCard: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: '16px 20px',
      marginBottom: 12,
      transition: 'border-color 0.2s, opacity 0.2s',
    },
    itemRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    },
    dragHandle: {
      cursor: 'grab',
      color: colors.textDim,
      fontSize: 16,
      padding: '4px',
      opacity: 0.5,
      transition: 'opacity 0.2s',
      userSelect: 'none',
    },
    itemLabel: { fontFamily: 'Nunito, sans-serif', fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 2 },
    itemDesc: { fontSize: 12, color: colors.textDim },
    itemControl: { marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    itemActions: { display: 'flex', gap: 6, marginLeft: 'auto' },
    checkbox: { width: 24, height: 24, accentColor: colors.accent, cursor: 'pointer' },
    scoreContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      maxWidth: '100%',
    },
    scoreBtn: {
      width: 32, height: 32, borderRadius: 8,
      border: `1px solid ${colors.border}`,
      background: 'transparent',
      color: colors.textDim,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'Nunito, sans-serif',
      transition: 'all 0.15s',
    },
    scoreBtnActive: {
      background: colors.accent,
      borderColor: colors.accent,
      color: '#fff',
    },
    editBtn: {
      background: colors.border,
      border: 'none',
      borderRadius: 6,
      color: colors.textMuted,
      cursor: 'pointer',
      fontSize: 12,
      padding: '6px 10px',
      transition: 'all 0.15s',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    textInput: {
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      padding: '8px 14px',
      color: colors.text,
      fontSize: 14,
      width: 160,
      fontFamily: 'Nunito, sans-serif',
      outline: 'none',
    },
    deleteBtn: {
      background: colors.border,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 6,
      color: colors.textMuted,
      cursor: 'pointer',
      fontSize: 14,
      padding: '6px 10px',
      transition: 'all 0.15s',
    },
    addItemBtn: {
      width: '100%',
      background: colors.bgCard,
      border: `1px dashed ${colors.textDim}`,
      borderRadius: 16,
      padding: '16px',
      color: colors.textMuted,
      cursor: 'pointer',
      fontSize: 14,
      marginTop: 8,
      fontFamily: 'Nunito, sans-serif',
      transition: 'all 0.2s',
    },
    modal: {
      position: 'fixed', inset: 0, background: '#000a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
    },
    modalBox: {
      background: colors.bgCard, border: `1px solid ${colors.borderLight}`,
      borderRadius: 20, padding: 32, width: '100%', maxWidth: 440,
    },
    modalTitle: { fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 700, color: colors.text, marginBottom: 24 },
    label: { fontSize: 12, color: colors.textDim, marginBottom: 6, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' },
    input: {
      width: '100%', background: colors.bgInput, border: `1px solid ${colors.border}`,
      borderRadius: 10, padding: '12px 16px', color: colors.text, fontSize: 14,
      fontFamily: 'Nunito, sans-serif', outline: 'none', marginBottom: 16,
    },
    typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 },
    freqGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 20 },
    freqBtn: {
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '8px 6px',
      cursor: 'pointer',
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      fontFamily: 'Nunito, sans-serif',
      transition: 'all 0.15s',
    },
    freqBtnActive: { borderColor: colors.accent, color: colors.accent, background: colors.accent + '11' },
    freqDesc: { fontSize: 10, color: colors.textDim, marginTop: 2 },
    daysGrid: { display: 'flex', gap: 6, marginBottom: 20, marginTop: 10 },
    dayBtn: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 600,
      color: colors.textMuted,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s',
    },
    dayBtnActive: { borderColor: colors.accent, color: '#fff', background: colors.accent },
    typeBtn: {
      background: colors.bgInput, border: `1px solid ${colors.border}`,
      borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
      fontSize: 13, color: colors.textDim, textAlign: 'left',
      fontFamily: 'Nunito, sans-serif', transition: 'all 0.15s',
    },
    typeBtnActive: { borderColor: colors.accent, color: colors.accent, background: colors.accent + '11' },
    rowBtns: { display: 'flex', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1, background: 'transparent', border: `1px solid ${colors.border}`,
      borderRadius: 10, padding: '12px', color: colors.textDim,
      cursor: 'pointer', fontSize: 14, fontFamily: 'Nunito, sans-serif',
    },
    saveBtn: {
      flex: 1, background: colors.accentGradient,
      border: 'none', borderRadius: 10, padding: '12px',
      color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
      fontFamily: 'Nunito, sans-serif',
    },
  }

  if (loading) return <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: colors.textDim }}>Loading...</div></div>

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.content}>
        <button style={s.back} onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>

        <div style={s.header}>
          <div style={s.ucTitle}>
            <span>{usecase?.icon}</span>
            <span>{usecase?.name}</span>
          </div>
          <div style={s.dateLabel}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>

          {items.length > 0 && (
            <>
              <div style={s.progressBar}>
                <div style={{ ...s.progressFill, width: `${progress}%` }} />
              </div>
              <div style={s.progressText}>{completedCount} of {items.length} completed today</div>
            </>
          )}
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: colors.textDim }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 16, color: colors.textMuted, marginBottom: 4 }}>No checklist items yet</p>
            <p style={{ fontSize: 13 }}>Add your first item to start tracking</p>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              style={{ ...s.itemCard, opacity: draggedItem?.id === item.id ? 0.5 : 1 }}
              draggable
              onDragStart={e => handleDragStart(e, item)}
              onDragOver={e => handleDragOver(e, item)}
              onDrop={e => handleDrop(e, item)}
              onDragEnd={handleDragEnd}
              onMouseEnter={e => e.currentTarget.style.borderColor = colors.borderLight}
              onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
            >
              <div style={s.itemRow}>
                {/* Drag handle */}
                <div
                  style={s.dragHandle}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                  title="Drag to reorder"
                >
                  ⋮⋮
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ ...s.itemLabel, color: todayEntries[item.id] ? colors.accent : colors.text }}>
                    {item.label}
                  </div>
                  {item.description && <div style={s.itemDesc}>{item.description}</div>}
                  <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{VALUE_TYPES.find(v => v.key === item.value_type)?.label}</span>
                    <span style={{ color: colors.accent }}>• {
                      (item.frequency || 'daily').startsWith('custom:')
                        ? (item.frequency.split(':')[1] || '').toUpperCase().split(',').join(', ')
                        : FREQUENCIES.find(f => f.key === (item.frequency || 'daily'))?.label || 'Daily'
                    }</span>
                  </div>
                </div>
              </div>

              <div style={s.itemControl}>
                {saving[item.id] && <span style={{ fontSize: 11, color: colors.accent }}>saving...</span>}

                {item.value_type === 'checkbox' && (
                  <input
                    type="checkbox"
                    style={s.checkbox}
                    checked={todayEntries[item.id]?.value === 'true'}
                    onChange={e => saveEntry(item.id, e.target.checked)}
                  />
                )}

                {item.value_type === 'score' && (
                  <div style={s.scoreContainer}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        style={{
                          ...s.scoreBtn,
                          ...(Number(todayEntries[item.id]?.value) === n ? s.scoreBtnActive : {})
                        }}
                        onClick={() => saveEntry(item.id, n)}
                      >{n}</button>
                    ))}
                  </div>
                )}

                {(item.value_type === 'number' || item.value_type === 'text') && (
                  <input
                    style={s.textInput}
                    type={item.value_type === 'number' ? 'number' : 'text'}
                    placeholder={item.value_type === 'number' ? '0' : 'Enter value...'}
                    value={todayEntries[item.id]?.value || ''}
                    onChange={e => saveEntry(item.id, e.target.value)}
                    onFocus={e => e.target.style.borderColor = colors.accent}
                    onBlur={e => e.target.style.borderColor = colors.border}
                  />
                )}

                <div style={s.itemActions}>
                  <button
                    style={s.editBtn}
                    onClick={() => setEditingItem(item)}
                    onMouseEnter={e => { e.currentTarget.style.background = colors.borderLight; e.currentTarget.style.color = colors.text }}
                    onMouseLeave={e => { e.currentTarget.style.background = colors.border; e.currentTarget.style.color = colors.textMuted }}
                    title="Edit item"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    style={s.deleteBtn}
                    onClick={() => deleteItem(item.id)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#3a2020'; e.currentTarget.style.borderColor = '#5a3030'; e.currentTarget.style.color = '#ff6b6b' }}
                    onMouseLeave={e => { e.currentTarget.style.background = colors.border; e.currentTarget.style.borderColor = colors.borderLight; e.currentTarget.style.color = colors.textMuted }}
                    title="Delete item"
                  >✕</button>
                </div>
              </div>
            </div>
          ))
        )}

        <button
          style={s.addItemBtn}
          onClick={() => setShowAddItem(true)}
          onMouseEnter={e => { e.target.style.borderColor = colors.accent; e.target.style.color = colors.accent }}
          onMouseLeave={e => { e.target.style.borderColor = colors.textDim; e.target.style.color = colors.textMuted }}
        >
          + Add Checklist Item
        </button>

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <button
            style={{ background: colors.accent + '22', border: `1px solid ${colors.accent}44`, borderRadius: 12, padding: '12px 24px', color: colors.accent, cursor: 'pointer', fontSize: 14, fontFamily: 'Nunito, sans-serif' }}
            onClick={() => navigate(`/usecase/${id}/stats`)}
          >
            📊 Check Your Progress
          </button>
        </div>
      </div>

      {showAddItem && (
        <div style={s.modal} onClick={() => setShowAddItem(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Checklist Item</h3>
            <label style={s.label}>Item label</label>
            <input
              style={s.input}
              placeholder="e.g. Did you take medication?"
              value={newItem.label}
              onChange={e => setNewItem(p => ({ ...p, label: e.target.value }))}
              autoFocus
            />
            <label style={s.label}>Description (optional)</label>
            <input
              style={s.input}
              placeholder="Any extra notes..."
              value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
            />
            <label style={s.label}>Value type</label>
            <div style={s.typeGrid}>
              {VALUE_TYPES.map(vt => (
                <button
                  key={vt.key}
                  style={{ ...s.typeBtn, ...(newItem.value_type === vt.key ? s.typeBtnActive : {}) }}
                  onClick={() => setNewItem(p => ({ ...p, value_type: vt.key }))}
                >
                  {vt.icon} {vt.label}
                </button>
              ))}
            </div>
            <label style={s.label}>Frequency</label>
            <div style={s.freqGrid}>
              {FREQUENCIES.map(f => (
                <button
                  key={f.key}
                  style={{ ...s.freqBtn, ...(newItem.frequency === f.key ? s.freqBtnActive : {}) }}
                  onClick={() => setNewItem(p => ({ ...p, frequency: f.key, customDays: f.key === 'custom' ? p.customDays : [] }))}
                >
                  <div>{f.label}</div>
                  <div style={s.freqDesc}>{f.desc}</div>
                </button>
              ))}
            </div>
            {newItem.frequency === 'custom' && (
              <div style={s.daysGrid}>
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.key}
                    style={{ ...s.dayBtn, ...(newItem.customDays.includes(day.key) ? s.dayBtnActive : {}) }}
                    onClick={() => toggleCustomDay(day.key)}
                    title={day.full}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
            <div style={s.rowBtns}>
              <button style={s.cancelBtn} onClick={() => setShowAddItem(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={addItem}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div style={s.modal} onClick={() => setEditingItem(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Edit Checklist Item</h3>
            <label style={s.label}>Item label</label>
            <input
              style={s.input}
              value={editingItem.label}
              onChange={e => setEditingItem(prev => ({ ...prev, label: e.target.value }))}
              autoFocus
            />
            <label style={s.label}>Description (optional)</label>
            <input
              style={s.input}
              placeholder="Any extra notes..."
              value={editingItem.description || ''}
              onChange={e => setEditingItem(prev => ({ ...prev, description: e.target.value }))}
            />
            <label style={s.label}>Value type</label>
            <div style={s.typeGrid}>
              {VALUE_TYPES.map(vt => (
                <button
                  key={vt.key}
                  style={{ ...s.typeBtn, ...(editingItem.value_type === vt.key ? s.typeBtnActive : {}) }}
                  onClick={() => setEditingItem(prev => ({ ...prev, value_type: vt.key }))}
                >
                  {vt.icon} {vt.label}
                </button>
              ))}
            </div>
            <div style={s.rowBtns}>
              <button style={s.cancelBtn} onClick={() => setEditingItem(null)}>Cancel</button>
              <button
                style={s.saveBtn}
                onClick={() => updateItem(editingItem.id, {
                  label: editingItem.label,
                  description: editingItem.description,
                  value_type: editingItem.value_type
                })}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
