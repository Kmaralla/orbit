import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Navbar from '../components/Navbar'

const VALUE_TYPES = [
  { key: 'checkbox', label: 'Done / Not Done', icon: '☑️' },
  { key: 'score', label: 'Score (1–10)', icon: '⭐' },
  { key: 'number', label: 'Number / Count', icon: '🔢' },
  { key: 'text', label: 'Text / Notes', icon: '📝' },
]

export default function Usecase() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [usecase, setUsecase] = useState(null)
  const [items, setItems] = useState([])
  const [todayEntries, setTodayEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({ label: '', value_type: 'checkbox', description: '' })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const { data: uc } = await supabase.from('usecases').select('*').eq('id', id).single()
    setUsecase(uc)

    const { data: its } = await supabase.from('checklist_items').select('*').eq('usecase_id', id).order('created_at')
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

  const addItem = async () => {
    if (!newItem.label.trim()) return
    const { data } = await supabase.from('checklist_items').insert({
      usecase_id: id,
      label: newItem.label,
      value_type: newItem.value_type,
      description: newItem.description
    }).select().single()
    if (data) {
      setItems(prev => [...prev, data])
      setNewItem({ label: '', value_type: 'checkbox', description: '' })
      setShowAddItem(false)
    }
  }

  const deleteItem = async (itemId) => {
    await supabase.from('checklist_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  const completedCount = items.filter(i => todayEntries[i.id]?.value !== undefined && todayEntries[i.id]?.value !== '').length
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0

  const s = {
    page: { minHeight: '100vh', background: '#080810' },
    content: { maxWidth: 800, margin: '0 auto', padding: '40px 24px' },
    back: { background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 14, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' },
    header: { marginBottom: 36 },
    ucTitle: { fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: '#e8e4f0', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 },
    progressBar: { background: '#1a1a2e', borderRadius: 8, height: 6, marginTop: 16, overflow: 'hidden' },
    progressFill: { height: '100%', background: 'linear-gradient(90deg, #6c63ff, #9b59b6)', borderRadius: 8, transition: 'width 0.5s ease' },
    progressText: { fontSize: 13, color: '#4a4870', marginTop: 8 },
    dateLabel: { fontSize: 13, color: '#6c63ff', marginBottom: 24, fontFamily: 'DM Sans, sans-serif' },
    itemCard: {
      background: '#0d0d1a',
      border: '1px solid #1a1a2e',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      transition: 'border-color 0.2s',
    },
    itemLabel: { fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 600, color: '#e8e4f0', marginBottom: 2 },
    itemDesc: { fontSize: 12, color: '#3a3858' },
    itemControl: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 },
    checkbox: { width: 24, height: 24, accentColor: '#6c63ff', cursor: 'pointer' },
    scoreBtn: {
      width: 36, height: 36, borderRadius: 8,
      border: '1px solid #1e1e32',
      background: 'transparent',
      color: '#4a4870',
      cursor: 'pointer',
      fontSize: 14,
      fontFamily: 'monospace',
      transition: 'all 0.15s',
    },
    scoreBtnActive: {
      background: '#6c63ff',
      borderColor: '#6c63ff',
      color: '#fff',
    },
    textInput: {
      background: '#0a0a16',
      border: '1px solid #1e1e32',
      borderRadius: 10,
      padding: '8px 14px',
      color: '#e8e4f0',
      fontSize: 14,
      width: 160,
      fontFamily: 'DM Sans, sans-serif',
      outline: 'none',
    },
    deleteBtn: {
      background: 'none',
      border: 'none',
      color: '#2a2840',
      cursor: 'pointer',
      fontSize: 16,
      padding: 4,
    },
    addItemBtn: {
      width: '100%',
      background: 'transparent',
      border: '1px dashed #2a2840',
      borderRadius: 16,
      padding: '16px',
      color: '#3a3858',
      cursor: 'pointer',
      fontSize: 14,
      marginTop: 8,
      fontFamily: 'DM Sans, sans-serif',
      transition: 'border-color 0.2s, color 0.2s',
    },
    modal: {
      position: 'fixed', inset: 0, background: '#000a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
    },
    modalBox: {
      background: '#0d0d1a', border: '1px solid #2a2a40',
      borderRadius: 20, padding: 32, width: '100%', maxWidth: 440,
    },
    modalTitle: { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#e8e4f0', marginBottom: 24 },
    label: { fontSize: 12, color: '#4a4870', marginBottom: 6, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' },
    input: {
      width: '100%', background: '#080810', border: '1px solid #1e1e32',
      borderRadius: 10, padding: '12px 16px', color: '#e8e4f0', fontSize: 14,
      fontFamily: 'DM Sans, sans-serif', outline: 'none', marginBottom: 16,
    },
    typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 },
    typeBtn: {
      background: '#080810', border: '1px solid #1e1e32',
      borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
      fontSize: 13, color: '#4a4870', textAlign: 'left',
      fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
    },
    typeBtnActive: { borderColor: '#6c63ff', color: '#6c63ff', background: '#6c63ff11' },
    rowBtns: { display: 'flex', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1, background: 'transparent', border: '1px solid #1e1e32',
      borderRadius: 10, padding: '12px', color: '#4a4870',
      cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans, sans-serif',
    },
    saveBtn: {
      flex: 1, background: 'linear-gradient(135deg, #6c63ff, #9b59b6)',
      border: 'none', borderRadius: 10, padding: '12px',
      color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
      fontFamily: 'DM Sans, sans-serif',
    },
  }

  if (loading) return <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#4a4870' }}>Loading...</div></div>

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
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#2a2840' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 16, color: '#3a3858', marginBottom: 4 }}>No checklist items yet</p>
            <p style={{ fontSize: 13 }}>Add your first item to start tracking</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} style={s.itemCard}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a40'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a2e'}
            >
              <div style={{ flex: 1 }}>
                <div style={{ ...s.itemLabel, color: todayEntries[item.id] ? '#a89fff' : '#e8e4f0' }}>
                  {item.label}
                </div>
                {item.description && <div style={s.itemDesc}>{item.description}</div>}
                <div style={{ fontSize: 11, color: '#2a2840', marginTop: 2 }}>
                  {VALUE_TYPES.find(v => v.key === item.value_type)?.label}
                </div>
              </div>

              <div style={s.itemControl}>
                {saving[item.id] && <span style={{ fontSize: 11, color: '#6c63ff' }}>saving...</span>}

                {item.value_type === 'checkbox' && (
                  <input
                    type="checkbox"
                    style={s.checkbox}
                    checked={todayEntries[item.id]?.value === 'true'}
                    onChange={e => saveEntry(item.id, e.target.checked)}
                  />
                )}

                {item.value_type === 'score' && (
                  <div style={{ display: 'flex', gap: 4 }}>
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
                    onFocus={e => e.target.style.borderColor = '#6c63ff'}
                    onBlur={e => e.target.style.borderColor = '#1e1e32'}
                  />
                )}

                <button style={s.deleteBtn} onClick={() => deleteItem(item.id)} title="Delete item">✕</button>
              </div>
            </div>
          ))
        )}

        <button
          style={s.addItemBtn}
          onClick={() => setShowAddItem(true)}
          onMouseEnter={e => { e.target.style.borderColor = '#6c63ff'; e.target.style.color = '#6c63ff' }}
          onMouseLeave={e => { e.target.style.borderColor = '#2a2840'; e.target.style.color = '#3a3858' }}
        >
          + Add Checklist Item
        </button>

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <button
            style={{ background: '#6c63ff22', border: '1px solid #6c63ff44', borderRadius: 12, padding: '12px 24px', color: '#6c63ff', cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}
            onClick={() => navigate(`/usecase/${id}/stats`)}
          >
            📊 View Stats & Trends
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
            <div style={s.rowBtns}>
              <button style={s.cancelBtn} onClick={() => setShowAddItem(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={addItem}>Add Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
