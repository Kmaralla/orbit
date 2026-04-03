import { useTheme } from '../hooks/useTheme'

const MILESTONES = {
  day1:   { emoji: '🌱', title: 'First check-in!',        sub: 'Every great streak starts here.',          color: '#22c55e' },
  day7:   { emoji: '🔥', title: '7 days logged',          sub: 'A full week of showing up. That\'s real.',  color: '#f59e0b' },
  day14:  { emoji: '💪', title: '2 weeks strong',         sub: 'You\'re past the hard part. Keep going.',   color: '#6c63ff' },
  day30:  { emoji: '🏆', title: '30 days in',             sub: 'A month of consistency. This is a habit now.', color: '#22c55e' },
  day50:  { emoji: '💎', title: '50 days logged',         sub: 'Half a century of showing up. Incredible.', color: '#6c63ff' },
  day100: { emoji: '🌟', title: '100 days!',              sub: '100 days of building a better life. Legend.', color: '#f59e0b' },
  streak7:  { emoji: '⚡', title: '7-day streak',         sub: 'Unbroken for a week. Don\'t stop now.',      color: '#f59e0b' },
  streak30: { emoji: '🚀', title: '30-day streak',        sub: 'Thirty consecutive days. Extraordinary.',    color: '#22c55e' },
}

export function getMilestoneKey(totalActiveDays, currentStreak) {
  // Return the highest-priority new milestone to show
  if (currentStreak === 30) return 'streak30'
  if (currentStreak === 7)  return 'streak7'
  if (totalActiveDays === 100) return 'day100'
  if (totalActiveDays === 50)  return 'day50'
  if (totalActiveDays === 30)  return 'day30'
  if (totalActiveDays === 14)  return 'day14'
  if (totalActiveDays === 7)   return 'day7'
  if (totalActiveDays === 1)   return 'day1'
  return null
}

export default function MilestoneCelebration({ milestoneKey, orbitName, stats, onClose }) {
  const { colors } = useTheme()
  const m = MILESTONES[milestoneKey]
  if (!m) return null

  return (
    <>
      <style>{`
        @keyframes milestoneIn {
          0%   { opacity: 0; transform: scale(0.85) translateY(20px); }
          60%  { transform: scale(1.03) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes confettiFall {
          0%   { opacity: 1; transform: translateY(-10px) rotate(0deg); }
          100% { opacity: 0; transform: translateY(80px) rotate(360deg); }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: '#000d', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }} onClick={onClose}>
        <div
          style={{
            background: colors.bgCard,
            border: `2px solid ${m.color}44`,
            borderRadius: 28,
            padding: '40px 32px',
            maxWidth: 380,
            width: '100%',
            textAlign: 'center',
            animation: 'milestoneIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            boxShadow: `0 0 60px ${m.color}22`,
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Glow ring */}
          <div style={{
            position: 'absolute', inset: -1,
            borderRadius: 28,
            background: `radial-gradient(ellipse at top, ${m.color}18, transparent 60%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>{m.emoji}</div>

          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '1.5px',
            textTransform: 'uppercase', color: m.color, marginBottom: 8,
          }}>
            {orbitName}
          </div>

          <h2 style={{
            fontFamily: 'Nunito, sans-serif', fontSize: 26, fontWeight: 900,
            color: colors.text, margin: '0 0 10px', lineHeight: 1.2,
          }}>
            {m.title}
          </h2>

          <p style={{
            fontSize: 15, color: colors.textDim, lineHeight: 1.6, margin: '0 0 24px',
          }}>
            {m.sub}
          </p>

          {/* Stats row */}
          {stats && (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 28, justifyContent: 'center',
            }}>
              {stats.map(({ label, value }) => (
                <div key={label} style={{
                  flex: 1, background: m.color + '14',
                  border: `1px solid ${m.color}33`,
                  borderRadius: 12, padding: '10px 8px',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: m.color, fontFamily: 'Nunito, sans-serif', lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 10, color: colors.textDim, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%', background: m.color,
              border: 'none', borderRadius: 14,
              padding: '14px', color: '#fff',
              fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
            }}
          >
            Keep going →
          </button>
        </div>
      </div>
    </>
  )
}
