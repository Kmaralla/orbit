import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AddUsecase({ onClose, onCreated, userId, icons }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🎯')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifyTime, setNotifyTime] = useState('09:00')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { data } = await supabase.from('usecases').insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      icon,
      notify_email: notifyEmail || null,
      notify_time: notifyTime,
    }).select().single()
    if (data) onCreated(data)
    setSaving(false)
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: '#000b', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
    box: { background: '#0d0d1a', border: '1px solid #2a2a40', borderRadius: 24, padding: 36, width: '100%', maxWidth: 480 },
    title: { fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: '#e8e4f0', marginBottom: 28 },
    label: { fontSize: 12, color: '#4a4870', marginBottom: 6, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' },
    input: { width: '100%', background: '#080810', border: '1px solid #1e1e32', borderRadius: 10, padding: '12px 16px', color: '#e8e4f0', fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', marginBottom: 16 },
    iconGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    iconBtn: { width: 44, height: 44, borderRadius: 10, border: '1px solid #1e1e32', background: '#080810', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
    section: { borderTop: '1px solid #1a1a2e', paddingTop: 20, marginTop: 4, marginBottom: 16 },
    sectionLabel: { fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#3a3858', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 },
    row: { display: 'flex', gap: 10, marginTop: 8 },
    cancelBtn: { flex: 1, background: 'transparent', border: '1px solid #1e1e32', borderRadius: 12, padding: '14px', color: '#4a4870', cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans, sans-serif' },
    saveBtn: { flex: 2, background: 'linear-gradient(135deg, #6c63ff, #9b59b6)', border: 'none', borderRadius: 12, padding: '14px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.7 : 1 },
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <h2 style={s.title}>New Orbit</h2>

        <label style={s.label}>Name</label>
        <input style={s.input} placeholder="e.g. Dad's Health, Career Goals..." value={name} onChange={e => setName(e.target.value)} autoFocus
          onFocus={e => e.target.style.borderColor = '#6c63ff'} onBlur={e => e.target.style.borderColor = '#1e1e32'} />

        <label style={s.label}>Description (optional)</label>
        <input style={s.input} placeholder="What are you tracking?" value={description} onChange={e => setDescription(e.target.value)}
          onFocus={e => e.target.style.borderColor = '#6c63ff'} onBlur={e => e.target.style.borderColor = '#1e1e32'} />

        <label style={s.label}>Icon</label>
        <div style={s.iconGrid}>
          {icons.map(ic => (
            <button key={ic} style={{ ...s.iconBtn, borderColor: icon === ic ? '#6c63ff' : '#1e1e32', background: icon === ic ? '#6c63ff22' : '#080810' }}
              onClick={() => setIcon(ic)}>{ic}</button>
          ))}
        </div>

        <div style={s.section}>
          <div style={s.sectionLabel}>🔔 Email Reminders (optional)</div>
          <label style={s.label}>Reminder email</label>
          <input style={s.input} type="email" placeholder="dad@example.com" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)}
            onFocus={e => e.target.style.borderColor = '#6c63ff'} onBlur={e => e.target.style.borderColor = '#1e1e32'} />
          <label style={s.label}>Daily reminder time</label>
          <input style={{ ...s.input, marginBottom: 0 }} type="time" value={notifyTime} onChange={e => setNotifyTime(e.target.value)} />
        </div>

        <div style={s.row}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'Creating...' : 'Create Orbit ✦'}
          </button>
        </div>
      </div>
    </div>
  )
}
