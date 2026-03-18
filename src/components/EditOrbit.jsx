import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

const ICONS = ['👴', '👧', '💼', '🧘', '💪', '📚', '❤️', '🎯', '🌱', '🏠', '✈️', '🎨', '💰', '🎮', '🍎', '☕']
const VALUE_TYPES = [
  { key: 'checkbox', label: 'Checkbox', icon: '☑️' },
  { key: 'score', label: 'Score (1-10)', icon: '⭐' },
  { key: 'number', label: 'Number', icon: '🔢' },
  { key: 'text', label: 'Text', icon: '📝' },
]

export default function EditOrbit({ orbit, onClose, onUpdated, onDeleted }) {
  const { colors } = useTheme()
  const [tab, setTab] = useState('details') // 'details' or 'checklist'

  // Orbit details
  const [name, setName] = useState(orbit.name)
  const [description, setDescription] = useState(orbit.description || '')
  const [icon, setIcon] = useState(orbit.icon)

  // Checklist items
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New item form
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('checkbox')

  useEffect(() => {
    fetchItems()
  }, [orbit.id])

  const fetchItems = async () => {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('usecase_id', orbit.id)
      .order('created_at')
    setItems(data || [])
    setLoading(false)
  }

  const saveDetails = async () => {
    setSaving(true)
    const { data, error } = await supabase
      .from('usecases')
      .update({ name, description, icon })
      .eq('id', orbit.id)
      .select()
      .single()

    if (!error && data) {
      onUpdated(data)
    }
    setSaving(false)
  }

  const addItem = async () => {
    if (!newLabel.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('checklist_items')
      .insert({
        usecase_id: orbit.id,
        label: newLabel.trim(),
        value_type: newType,
      })
      .select()
      .single()

    if (data) {
      setItems(prev => [...prev, data])
      setNewLabel('')
      setNewType('checkbox')
    }
    setSaving(false)
  }

  const updateItem = async (itemId, updates) => {
    await supabase
      .from('checklist_items')
      .update(updates)
      .eq('id', itemId)

    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i))
  }

  const deleteItem = async (itemId) => {
    if (!confirm('Delete this checklist item? All check-in data for it will be lost.')) return

    await supabase.from('checklist_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  const deleteOrbit = async () => {
    if (!confirm(`Delete "${orbit.name}"? This will remove all checklist items and check-in history.`)) return

    await supabase.from('usecases').delete().eq('id', orbit.id)
    onDeleted(orbit.id)
    onClose()
  }

  const s = {
    overlay: {
      position: 'fixed',
      inset: 0,
      background: '#000b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: 20,
    },
    box: {
      background: colors.bgCard,
      border: `1px solid ${colors.borderLight}`,
      borderRadius: 24,
      width: '100%',
      maxWidth: 520,
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      padding: '24px 28px 0',
      borderBottom: `1px solid ${colors.border}`,
    },
    title: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 22,
      fontWeight: 800,
      color: colors.text,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    tabs: {
      display: 'flex',
      gap: 0,
    },
    tab: {
      padding: '12px 20px',
      fontSize: 14,
      fontWeight: 600,
      color: colors.textDim,
      background: 'transparent',
      border: 'none',
      borderBottom: '2px solid transparent',
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
      transition: 'all 0.2s',
    },
    tabActive: {
      color: colors.accent,
      borderBottomColor: colors.accent,
    },
    content: {
      padding: '24px 28px',
      overflowY: 'auto',
      flex: 1,
    },
    label: {
      fontSize: 12,
      color: colors.textDim,
      marginBottom: 6,
      display: 'block',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    input: {
      width: '100%',
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      padding: '12px 16px',
      color: colors.text,
      fontSize: 14,
      fontFamily: 'Nunito, sans-serif',
      outline: 'none',
      marginBottom: 16,
    },
    iconGrid: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      border: `1px solid ${colors.border}`,
      background: colors.bgInput,
      fontSize: 18,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s',
    },
    itemCard: {
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '12px 16px',
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    itemIcon: {
      fontSize: 16,
      width: 28,
      textAlign: 'center',
    },
    itemLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
    },
    itemType: {
      fontSize: 11,
      color: colors.textDim,
      background: colors.border,
      padding: '2px 8px',
      borderRadius: 4,
    },
    deleteBtn: {
      background: 'transparent',
      border: 'none',
      color: colors.textDim,
      cursor: 'pointer',
      fontSize: 16,
      padding: 4,
      opacity: 0.6,
      transition: 'opacity 0.2s',
    },
    addForm: {
      background: colors.bg,
      border: `1px dashed ${colors.border}`,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    },
    typeGrid: {
      display: 'flex',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    typeBtn: {
      padding: '8px 12px',
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      background: colors.bgInput,
      color: colors.textMuted,
      fontSize: 12,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'Nunito, sans-serif',
    },
    footer: {
      padding: '16px 28px',
      borderTop: `1px solid ${colors.border}`,
      display: 'flex',
      gap: 10,
    },
    cancelBtn: {
      flex: 1,
      background: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '14px',
      color: colors.textDim,
      cursor: 'pointer',
      fontSize: 14,
      fontFamily: 'Nunito, sans-serif',
    },
    saveBtn: {
      flex: 2,
      background: colors.accentGradient,
      border: 'none',
      borderRadius: 12,
      padding: '14px',
      color: '#fff',
      cursor: 'pointer',
      fontSize: 15,
      fontWeight: 600,
      fontFamily: 'Nunito, sans-serif',
    },
    dangerBtn: {
      background: 'transparent',
      border: '1px solid #e74c3c44',
      borderRadius: 10,
      padding: '10px 16px',
      color: '#e74c3c',
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: 'Nunito, sans-serif',
      marginTop: 20,
    },
    emptyState: {
      textAlign: 'center',
      padding: '30px 20px',
      color: colors.textDim,
    },
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        {/* Header with tabs */}
        <div style={s.header}>
          <h2 style={s.title}>
            <span>{orbit.icon}</span>
            Edit Orbit
          </h2>
          <div style={s.tabs}>
            <button
              style={{ ...s.tab, ...(tab === 'details' ? s.tabActive : {}) }}
              onClick={() => setTab('details')}
            >
              Details
            </button>
            <button
              style={{ ...s.tab, ...(tab === 'checklist' ? s.tabActive : {}) }}
              onClick={() => setTab('checklist')}
            >
              Checklist ({items.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={s.content}>
          {tab === 'details' ? (
            <>
              <label style={s.label}>Name</label>
              <input
                style={s.input}
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={e => e.target.style.borderColor = colors.accent}
                onBlur={e => e.target.style.borderColor = colors.border}
              />

              <label style={s.label}>Description</label>
              <input
                style={s.input}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What are you tracking?"
                onFocus={e => e.target.style.borderColor = colors.accent}
                onBlur={e => e.target.style.borderColor = colors.border}
              />

              <label style={s.label}>Icon</label>
              <div style={s.iconGrid}>
                {ICONS.map(ic => (
                  <button
                    key={ic}
                    style={{
                      ...s.iconBtn,
                      borderColor: icon === ic ? colors.accent : colors.border,
                      background: icon === ic ? colors.accent + '22' : colors.bgInput
                    }}
                    onClick={() => setIcon(ic)}
                  >
                    {ic}
                  </button>
                ))}
              </div>

              <button style={s.dangerBtn} onClick={deleteOrbit}>
                🗑️ Delete this orbit
              </button>
            </>
          ) : (
            <>
              {loading ? (
                <div style={s.emptyState}>Loading...</div>
              ) : items.length === 0 ? (
                <div style={s.emptyState}>
                  No checklist items yet.<br />Add your first item below.
                </div>
              ) : (
                items.map(item => (
                  <div key={item.id} style={s.itemCard}>
                    <span style={s.itemIcon}>
                      {VALUE_TYPES.find(t => t.key === item.value_type)?.icon || '☑️'}
                    </span>
                    <input
                      style={{ ...s.itemLabel, background: 'transparent', border: 'none', outline: 'none' }}
                      value={item.label}
                      onChange={e => updateItem(item.id, { label: e.target.value })}
                    />
                    <span style={s.itemType}>{item.value_type}</span>
                    <button
                      style={s.deleteBtn}
                      onClick={() => deleteItem(item.id)}
                      onMouseEnter={e => e.target.style.opacity = 1}
                      onMouseLeave={e => e.target.style.opacity = 0.6}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}

              {/* Add new item */}
              <div style={s.addForm}>
                <label style={s.label}>Add New Item</label>
                <input
                  style={{ ...s.input, marginBottom: 12 }}
                  placeholder="e.g., Did I exercise today?"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                />
                <label style={s.label}>Type</label>
                <div style={s.typeGrid}>
                  {VALUE_TYPES.map(t => (
                    <button
                      key={t.key}
                      style={{
                        ...s.typeBtn,
                        borderColor: newType === t.key ? colors.accent : colors.border,
                        background: newType === t.key ? colors.accent + '22' : colors.bgInput,
                        color: newType === t.key ? colors.accent : colors.textMuted,
                      }}
                      onClick={() => setNewType(t.key)}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <button
                  style={{ ...s.saveBtn, marginTop: 12, opacity: !newLabel.trim() ? 0.5 : 1 }}
                  onClick={addItem}
                  disabled={!newLabel.trim() || saving}
                >
                  + Add Item
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>
            {tab === 'details' ? 'Cancel' : 'Close'}
          </button>
          {tab === 'details' && (
            <button
              style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}
              onClick={saveDetails}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
