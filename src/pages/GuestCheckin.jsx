import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function fetchOrbit(token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/shared-checkin?token=${token}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status}`)
  }
  return res.json()
}

async function submitCheckin(token, entries) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/shared-checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, entries }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status}`)
  }
  return res.json()
}

export default function GuestCheckin() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // loading | ready | submitting | done | error
  const [orbit, setOrbit] = useState(null)
  const [items, setItems] = useState([])
  const [values, setValues] = useState({})
  const [errorMsg, setErrorMsg] = useState('')
  const [today, setToday] = useState('')

  useEffect(() => {
    fetchOrbit(token)
      .then(data => {
        setOrbit(data.orbit)
        setItems(data.items)
        setValues(data.entries || {})
        setToday(data.today)
        setState('ready')
      })
      .catch(err => {
        setErrorMsg(err.message)
        setState('error')
      })
  }, [token])

  const setValue = (itemId, val) => setValues(prev => ({ ...prev, [itemId]: String(val) }))

  const handleSubmit = async () => {
    setState('submitting')
    try {
      const entries = Object.entries(values)
        .filter(([, v]) => v !== '' && v !== 'false' && v !== 'undefined')
        .map(([itemId, value]) => ({ itemId, value }))

      if (!entries.length) {
        setState('ready')
        return
      }
      await submitCheckin(token, entries)
      setState('done')
    } catch (err) {
      setErrorMsg(err.message)
      setState('error')
    }
  }

  const doneCount = items.filter(item => {
    const v = values[item.id]
    return v && v !== '' && v !== 'false'
  }).length

  const s = {
    page: { minHeight: '100vh', background: '#f8f7ff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    inner: { maxWidth: 480, margin: '0 auto', padding: '32px 20px 60px' },
    logo: { fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 28, display: 'block' },
    orbitHeader: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '20px 22px', marginBottom: 20 },
    orbitIcon: { fontSize: 36, marginBottom: 8 },
    orbitName: { fontFamily: 'system-ui, sans-serif', fontSize: 22, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 },
    orbitDesc: { fontSize: 13, color: '#6b7280', lineHeight: 1.5 },
    dateLabel: { fontSize: 12, color: '#9ca3af', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.5px' },
    card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px', marginBottom: 12 },
    itemLabel: { fontSize: 15, color: '#1a1a2e', marginBottom: 12, fontWeight: 500, lineHeight: 1.4 },
    checkBtn: { width: 34, height: 34, borderRadius: '50%', border: '2px solid #d1d5db', background: 'transparent', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 },
    numberInput: { width: 80, background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 15, color: '#1a1a2e', outline: 'none', textAlign: 'center' },
    scoreGrid: { display: 'flex', gap: 6, flexWrap: 'wrap' },
    scoreBtn: { width: 34, height: 34, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
    textInput: { width: '100%', background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#1a1a2e', outline: 'none', resize: 'vertical', minHeight: 64, boxSizing: 'border-box' },
    submitBtn: { width: '100%', background: 'linear-gradient(135deg, #6c63ff 0%, #5b54e0 100%)', border: 'none', borderRadius: 14, padding: '16px', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8, transition: 'opacity 0.2s' },
    progress: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (state === 'error') return (
    <div style={s.page}>
      <div style={s.inner}>
        <span style={s.logo}><span style={{ color: '#6c63ff' }}>●</span> Orbit</span>
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
            {errorMsg.includes('expired') ? 'This link has expired' : 'Link not found'}
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            {errorMsg.includes('expired')
              ? 'Ask the person who shared this to send you a fresh link.'
              : 'This check-in link is invalid or has been removed.'}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state === 'loading') return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #6c63ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, color: '#6b7280' }}>Loading check-in...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  // ── Done ──────────────────────────────────────────────────────────────────
  if (state === 'done') return (
    <div style={s.page}>
      <div style={s.inner}>
        <span style={s.logo}><span style={{ color: '#6c63ff' }}>●</span> Orbit</span>
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #bbf7d0', borderRadius: 20, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginBottom: 8 }}>Check-in saved!</div>
          <div style={{ fontSize: 15, color: '#166534', lineHeight: 1.6, marginBottom: 4 }}>
            {orbit?.icon} {orbit?.name}
          </div>
          <div style={{ fontSize: 13, color: '#4ade80', marginTop: 12 }}>
            {doneCount} item{doneCount !== 1 ? 's' : ''} logged for today
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
          Want to track your own life goals?{' '}
          <a href="/" style={{ color: '#6c63ff', textDecoration: 'none', fontWeight: 600 }}>Try Orbit free →</a>
        </p>
      </div>
    </div>
  )

  // ── Ready ─────────────────────────────────────────────────────────────────
  const dateStr = today
    ? new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <span style={s.logo}><span style={{ color: '#6c63ff' }}>●</span> Orbit</span>

        {/* Orbit header */}
        <div style={s.orbitHeader}>
          <div style={s.orbitIcon}>{orbit?.icon}</div>
          <div style={s.orbitName}>{orbit?.name}</div>
          {orbit?.description && <div style={s.orbitDesc}>{orbit.description}</div>}
          <div style={s.dateLabel}>{dateStr}</div>
        </div>

        {/* Progress */}
        {items.length > 0 && (
          <div style={s.progress}>
            <div style={{ flex: 1, height: 5, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round((doneCount / items.length) * 100)}%`, background: doneCount === items.length ? '#22c55e' : '#6c63ff', borderRadius: 4, transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{doneCount}/{items.length} done</span>
          </div>
        )}

        {/* Items */}
        {items.map(item => {
          const val = values[item.id]
          const isDone = val && val !== '' && val !== 'false'

          return (
            <div key={item.id} style={{ ...s.card, borderColor: isDone ? '#bbf7d0' : '#e5e7eb', background: isDone ? '#f0fdf4' : '#fff' }}>
              <div style={s.itemLabel}>{item.label}</div>

              {item.value_type === 'checkbox' && (
                <button
                  style={{ ...s.checkBtn, borderColor: isDone ? '#22c55e' : '#d1d5db', background: isDone ? '#22c55e' : 'transparent', color: '#fff' }}
                  onClick={() => setValue(item.id, isDone ? 'false' : 'true')}
                >
                  {isDone ? '✓' : ''}
                </button>
              )}

              {item.value_type === 'score' && (
                <div style={s.scoreGrid}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      style={{ ...s.scoreBtn, borderColor: Number(val) === n ? '#6c63ff' : '#e5e7eb', background: Number(val) === n ? '#6c63ff' : '#f9fafb', color: Number(val) === n ? '#fff' : '#374151' }}
                      onClick={() => setValue(item.id, n)}
                    >{n}</button>
                  ))}
                </div>
              )}

              {item.value_type === 'number' && (
                <input
                  type="number"
                  style={s.numberInput}
                  placeholder="0"
                  value={val || ''}
                  onChange={e => setValue(item.id, e.target.value)}
                />
              )}

              {item.value_type === 'text' && (
                <textarea
                  style={s.textInput}
                  placeholder="Add a note..."
                  value={val || ''}
                  onChange={e => setValue(item.id, e.target.value)}
                />
              )}
            </div>
          )
        })}

        <button
          style={{ ...s.submitBtn, opacity: state === 'submitting' ? 0.7 : 1, cursor: state === 'submitting' ? 'not-allowed' : 'pointer' }}
          onClick={handleSubmit}
          disabled={state === 'submitting'}
        >
          {state === 'submitting' ? 'Saving...' : `Submit Check-in${doneCount > 0 ? ` (${doneCount} logged)` : ''}`}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 16, lineHeight: 1.6 }}>
          Your check-in will be visible to the person who shared this link.
        </p>
      </div>
    </div>
  )
}
