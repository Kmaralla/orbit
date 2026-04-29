import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

// Sample demo data
const DEMO_ORBITS = [
  {
    id: 'demo-1',
    name: "Dad's Health",
    icon: '👴',
    description: 'Tracking daily health and wellness',
    items: [
      { id: 'i1', label: 'Morning medication taken?', value_type: 'checkbox', checked: true },
      { id: 'i2', label: 'Energy level', value_type: 'score', value: 7 },
      { id: 'i3', label: 'Blood pressure', value_type: 'text', value: '120/80' },
      { id: 'i4', label: 'Steps walked', value_type: 'number', value: 4500 },
    ],
    todayChecked: 3,
  },
  {
    id: 'demo-2',
    name: 'Kids Routine',
    icon: '👧',
    description: 'Daily activities and homework',
    items: [
      { id: 'i5', label: 'Homework completed?', value_type: 'checkbox', checked: true },
      { id: 'i6', label: 'Reading time (mins)', value_type: 'number', value: 30 },
      { id: 'i7', label: 'Behavior rating', value_type: 'score', value: 8 },
    ],
    todayChecked: 2,
  },
  {
    id: 'demo-3',
    name: 'Career Goals',
    icon: '💼',
    description: 'Professional development tracking',
    items: [
      { id: 'i8', label: 'Worked on side project?', value_type: 'checkbox', checked: false },
      { id: 'i9', label: 'Learning hours', value_type: 'number', value: 0 },
      { id: 'i10', label: 'Productivity score', value_type: 'score', value: 6 },
    ],
    todayChecked: 0,
  },
]

export default function Demo() {
  const { colors } = useTheme()
  const navigate = useNavigate()
  const [selectedOrbit, setSelectedOrbit] = useState(null)
  const [demoItems, setDemoItems] = useState(DEMO_ORBITS)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const updateItem = (orbitId, itemId, value) => {
    setDemoItems(prev => prev.map(orbit => {
      if (orbit.id !== orbitId) return orbit
      return {
        ...orbit,
        items: orbit.items.map(item => {
          if (item.id !== itemId) return item
          if (item.value_type === 'checkbox') return { ...item, checked: value }
          return { ...item, value }
        }),
        todayChecked: orbit.items.filter(i =>
          i.id === itemId ? (typeof value === 'boolean' ? value : !!value) : (i.checked || i.value)
        ).length
      }
    }))
  }

  const s = {
    page: { minHeight: '100vh', background: colors.bg },
    banner: {
      background: `linear-gradient(135deg, ${colors.accent}22 0%, ${colors.accent}11 100%)`,
      borderBottom: `1px solid ${colors.accent}44`,
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      flexWrap: 'wrap',
    },
    bannerText: {
      fontSize: 14,
      color: colors.text,
      fontFamily: 'Nunito, sans-serif',
    },
    bannerBtn: {
      background: colors.accent,
      border: 'none',
      borderRadius: 8,
      padding: '8px 16px',
      color: '#fff',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
    },
    content: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    greeting: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 32,
      fontWeight: 700,
      color: colors.text,
    },
    greetingSub: { fontSize: 15, color: colors.textDim, marginTop: 4 },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: 20,
    },
    card: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 20,
      padding: '24px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      position: 'relative',
      overflow: 'hidden',
    },
    cardIcon: { fontSize: 36, marginBottom: 12 },
    cardName: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 18,
      fontWeight: 700,
      color: colors.text,
      marginBottom: 4,
    },
    cardDesc: { fontSize: 13, color: colors.textDim, marginBottom: 16 },
    badge: {
      background: colors.accent + '22',
      border: `1px solid ${colors.accent}44`,
      borderRadius: 8,
      padding: '5px 12px',
      fontSize: 12,
      color: colors.accent,
      display: 'inline-block',
    },
    modal: {
      position: 'fixed',
      inset: 0,
      background: '#000a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: 20,
    },
    modalBox: {
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: 24,
      padding: 32,
      width: '100%',
      maxWidth: 500,
      maxHeight: '80vh',
      overflow: 'auto',
    },
    modalHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    modalTitle: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 24,
      fontWeight: 700,
      color: colors.text,
    },
    itemCard: {
      background: colors.bgInput,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '16px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    },
    itemLabel: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontFamily: 'Nunito, sans-serif',
    },
    checkbox: {
      width: 24,
      height: 24,
      accentColor: colors.accent,
      cursor: 'pointer',
    },
    scoreBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      border: `1px solid ${colors.border}`,
      background: 'transparent',
      color: colors.textDim,
      cursor: 'pointer',
      fontSize: 13,
      transition: 'all 0.15s',
    },
    scoreBtnActive: {
      background: colors.accent,
      borderColor: colors.accent,
      color: '#fff',
    },
    input: {
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '8px 12px',
      color: colors.text,
      fontSize: 14,
      width: 100,
      outline: 'none',
      fontFamily: 'Nunito, sans-serif',
    },
    closeBtn: {
      background: colors.accent,
      border: 'none',
      borderRadius: 12,
      padding: '14px',
      color: '#fff',
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
      width: '100%',
      marginTop: 16,
    },
  }

  return (
    <div style={s.page}>
      {/* Demo Banner */}
      <div style={s.banner}>
        <span style={s.bannerText}>👀 You're exploring Orbit as a guest with sample data</span>
        <button style={s.bannerBtn} onClick={() => navigate('/')}>
          Create Free Account
        </button>
      </div>

      <div style={s.content}>
        <div style={s.header}>
          <div>
            <h1 style={s.greeting}>{greeting}, Guest! 👋</h1>
            <p style={s.greetingSub}>Try checking in on these sample orbits</p>
          </div>
        </div>

        <div style={s.grid}>
          {demoItems.map(orbit => (
            <div
              key={orbit.id}
              style={s.card}
              onClick={() => setSelectedOrbit(orbit)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: colors.accentGradient }} />
              <div style={s.cardIcon}>{orbit.icon}</div>
              <div style={s.cardName}>{orbit.name}</div>
              <div style={s.cardDesc}>{orbit.description}</div>
              <span style={s.badge}>
                {orbit.todayChecked > 0 ? `✓ ${orbit.todayChecked}/${orbit.items.length} checked` : '○ Not checked today'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Check-in Modal */}
      {selectedOrbit && (
        <div style={s.modal} onClick={() => setSelectedOrbit(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={{ fontSize: 40 }}>{selectedOrbit.icon}</span>
              <div>
                <div style={s.modalTitle}>{selectedOrbit.name}</div>
                <div style={{ fontSize: 13, color: colors.textDim }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            {selectedOrbit.items.map(item => (
              <div key={item.id} style={s.itemCard}>
                <div style={s.itemLabel}>{item.label}</div>

                {item.value_type === 'checkbox' && (
                  <input
                    type="checkbox"
                    style={s.checkbox}
                    checked={item.checked || false}
                    onChange={e => updateItem(selectedOrbit.id, item.id, e.target.checked)}
                  />
                )}

                {item.value_type === 'score' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        style={{ ...s.scoreBtn, ...(item.value === n ? s.scoreBtnActive : {}) }}
                        onClick={() => updateItem(selectedOrbit.id, item.id, n)}
                      >{n}</button>
                    ))}
                  </div>
                )}

                {(item.value_type === 'number' || item.value_type === 'text') && (
                  <input
                    type={item.value_type === 'number' ? 'number' : 'text'}
                    style={s.input}
                    value={item.value || ''}
                    onChange={e => updateItem(selectedOrbit.id, item.id, e.target.value)}
                    placeholder={item.value_type === 'number' ? '0' : 'Enter...'}
                  />
                )}
              </div>
            ))}

            <button style={s.closeBtn} onClick={() => setSelectedOrbit(null)}>
              Done ✓
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
