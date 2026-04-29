import { useEffect, useState } from 'react'
import { useTheme } from '../hooks/useTheme'

const MILESTONES = [7, 14, 21, 30, 60, 100]

const MILESTONE_COPY = {
  7:   { emoji: '🔥', label: '7-Day Streak!', msg: 'One week of showing up. That\'s a real habit forming.' },
  14:  { emoji: '💪', label: '2-Week Streak!', msg: 'Two weeks straight. Consistency is becoming your superpower.' },
  21:  { emoji: '⚡', label: '21 Days!', msg: 'They say it takes 21 days to build a habit. You\'ve done it.' },
  30:  { emoji: '🏆', label: '30-Day Streak!', msg: 'A full month. This orbit is now part of who you are.' },
  60:  { emoji: '🌟', label: '60 Days!', msg: 'Two months of consistency. Truly extraordinary.' },
  100: { emoji: '🚀', label: '100-Day Streak!', msg: 'Triple digits. You\'re in a category almost no one reaches.' },
}

/**
 * Call this from Dashboard after streaks load.
 * Returns the first uncelebrated milestone found (or null).
 */
export function checkStreakMilestone(orbitId, userId, currentStreak) {
  for (const m of [...MILESTONES].reverse()) {
    if (currentStreak >= m) {
      const key = `orbit_milestone_${userId}_${orbitId}_${m}`
      if (!localStorage.getItem(key)) return { milestone: m, orbitId }
      break // already celebrated this tier — check lower tier is not needed
    }
  }
  return null
}

export function markMilestoneSeen(userId, orbitId, milestone) {
  localStorage.setItem(`orbit_milestone_${userId}_${orbitId}_${milestone}`, '1')
}

// Simple CSS confetti using divs
function Confetti() {
  const COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.2}s`,
    duration: `${1.4 + Math.random() * 1}s`,
    size: 6 + Math.floor(Math.random() * 6),
    rotate: Math.floor(Math.random() * 360),
  }))

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-10px',
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : 2,
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

export default function StreakCelebration({ celebration, orbitName, onDismiss }) {
  const { colors } = useTheme()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (celebration) {
      setTimeout(() => setVisible(true), 80)
    }
  }, [celebration])

  if (!celebration) return null
  const copy = MILESTONE_COPY[celebration.milestone] || MILESTONE_COPY[7]

  const handleShare = () => {
    const text = `🔥 ${celebration.milestone}-day streak on ${orbitName} with Orbit! ${copy.msg} orbityours.com`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      alert('Copied to clipboard! Paste it anywhere to share.')
    }
  }

  const dismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={dismiss}
    >
      <Confetti />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.bgCard,
          border: `1.5px solid ${colors.accent}66`,
          borderRadius: 28,
          padding: '40px 36px',
          maxWidth: 380,
          width: '90%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          transform: visible ? 'scale(1)' : 'scale(0.85)',
          transition: 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16, animation: 'popIn 0.5s ease' }}>
          {copy.emoji}
        </div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 26, fontWeight: 900, color: colors.text, marginBottom: 6 }}>
          {copy.label}
        </div>
        <div style={{ fontSize: 13, color: colors.accent, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {orbitName}
        </div>
        <div style={{ fontSize: 15, color: colors.textDim, lineHeight: 1.6, marginBottom: 28 }}>
          {copy.msg}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={handleShare}
            style={{ background: colors.accent, border: 'none', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
          >
            Share this 🎉
          </button>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 20px', color: colors.textDim, fontSize: 14, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
          >
            Keep going →
          </button>
        </div>
        <style>{`@keyframes popIn { 0% { transform:scale(0.3);opacity:0 } 60% { transform:scale(1.2) } 100% { transform:scale(1);opacity:1 } }`}</style>
      </div>
    </div>
  )
}
