import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../hooks/useTheme'

const AVATARS = [
  {
    id: 'messi',
    name: 'Leo',
    label: '⚽ Leo',
    emoji: '⚽',
    bg: 'linear-gradient(135deg, #1a6b3a, #2d9e5a)',
    accent: '#2d9e5a',
    personality: 'You speak like a legendary football champion — direct, passionate, focused on consistency and discipline. You say things like "Every day is a final" and "Champions train when no one watches." Keep it motivational but grounded.',
  },
  {
    id: 'magnus',
    name: 'Magnus',
    label: '♟️ Magnus',
    emoji: '♟️',
    bg: 'linear-gradient(135deg, #1a2a6b, #3450b8)',
    accent: '#4a6ee0',
    personality: 'You think like a chess grandmaster — analytical, precise, always several moves ahead. You spot patterns in data, suggest strategic adjustments, and find the optimal path. Calm, logical, occasionally dry wit.',
  },
  {
    id: 'sage',
    name: 'Sage',
    label: '🌿 Sage',
    emoji: '🌿',
    bg: 'linear-gradient(135deg, #1a4a2a, #2a7a4a)',
    accent: '#4caf7d',
    personality: 'You are a mindful nature guide — calm, grounded, focused on sustainable growth and balance. You use nature metaphors: "Trees grow slowly but strongly." You emphasize rest, rhythm, and long-term wellbeing.',
  },
  {
    id: 'nova',
    name: 'Nova',
    label: '✨ Nova',
    emoji: '✨',
    bg: 'linear-gradient(135deg, #4a1a6b, #8b2fc9)',
    accent: '#b06aff',
    personality: 'You are an enthusiastic, creative spark — like a brilliant film director. You celebrate wins dramatically, find the story in the data, and inspire with vivid language. Energetic, warm, uplifting.',
  },
]

const SYSTEM_PROMPT = (avatar, orbitsContext) => `You are ${avatar.name}, a friendly AI coach inside the Orbit life-tracking app.

YOUR PERSONALITY:
${avatar.personality}

USER'S ORBIT DATA:
${orbitsContext}

STRICT RULES — NEVER BREAK THESE:
1. You ONLY discuss Orbit app topics: their orbits, check-in streaks, habits, stats, goals, productivity, and wellbeing within their tracked areas.
2. If asked about anything unrelated (coding help, recipes, news, math problems, other apps, etc.), you warmly decline and redirect: "I'm your Orbit coach — I can only help with your orbits and habits! Ask me about your streaks, progress, or how to build a better routine."
3. Never pretend to be a general AI assistant. Never answer general knowledge questions even if you know them.
4. Keep responses SHORT — 2-4 sentences usually. Be snappy and energetic.
5. Reference their actual orbit data when possible — be specific.
6. Always stay in character as ${avatar.name}.`

async function callClaude(messages, avatar, orbitsContext) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return "Hmm, I need an API key to chat! Ask the app admin to set up VITE_ANTHROPIC_API_KEY."

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT(avatar, orbitsContext),
      messages,
    }),
  })
  const data = await res.json()
  return data.content?.find(b => b.type === 'text')?.text || "I couldn't think of a response. Try again!"
}

function buildOrbitsContext(orbits, stats) {
  if (!orbits || orbits.length === 0) return 'User has no orbits yet.'
  return orbits.map(o => {
    const s = stats?.[o.id]
    // Support both Analytics stats format { pct, streak, atRisk } and Dashboard format { current, best, atRisk }
    const pct = s?.pct != null ? `${s.pct}%` : 'unknown'
    const streak = s?.streak ?? s?.current ?? 0
    const atRisk = s?.atRisk ? ' ⚠️ streak at risk today!' : ''
    return `• ${o.icon} ${o.name}: ${pct} completion, ${streak}-day streak${atRisk}`
  }).join('\n')
}

export default function OrbitChat({ orbits = [], stats = {} }) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [messages, setMessages] = useState([]) // { role: 'user'|'assistant', content: string }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open && messages.length === 0) {
      // Greeting message on first open
      const ctx = buildOrbitsContext(orbits, stats)
      const greeting = orbits.length === 0
        ? `Hey! I'm ${selectedAvatar.name}, your Orbit coach. Create your first orbit and I'll help you crush your goals!`
        : `Hey! I'm ${selectedAvatar.name}. You have ${orbits.length} orbit${orbits.length > 1 ? 's' : ''} — ask me anything about your progress!`
      setMessages([{ role: 'assistant', content: greeting }])
    }
  }, [open])

  useEffect(() => {
    // Reset messages when avatar changes (new coach, new convo)
    if (messages.length > 0) {
      const greeting = orbits.length === 0
        ? `Hey! I'm ${selectedAvatar.name}, your new Orbit coach. Create your first orbit and let's go!`
        : `Switching in! I'm ${selectedAvatar.name}. I can see your ${orbits.length} orbit${orbits.length > 1 ? 's' : ''}. What do you want to tackle?`
      setMessages([{ role: 'assistant', content: greeting }])
    }
  }, [selectedAvatar])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    const orbitsContext = buildOrbitsContext(orbits, stats)
    // Send last 10 messages to keep context window small
    const apiMessages = newMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    const reply = await callClaude(apiMessages, selectedAvatar, orbitsContext)

    setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const avatar = selectedAvatar

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            width: 56, height: 56, borderRadius: '50%',
            background: avatar.bg,
            border: 'none', cursor: 'pointer',
            boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 0 2px ${avatar.accent}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, transition: 'transform 0.2s, box-shadow 0.2s',
            animation: 'chatPulse 3s ease-in-out infinite',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = `0 6px 28px rgba(0,0,0,0.5), 0 0 0 3px ${avatar.accent}88` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.4), 0 0 0 2px ${avatar.accent}55` }}
          title={`Chat with ${avatar.name}`}
        >
          {avatar.emoji}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 340, maxWidth: 'calc(100vw - 32px)',
          background: colors.bgCard,
          border: `1px solid ${colors.border}`,
          borderRadius: 20,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* Header */}
          <div style={{
            background: avatar.bg,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            {/* Avatar button — click to switch */}
            <button
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.3)',
                fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title="Switch coach"
            >
              {avatar.emoji}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>
                {avatar.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Your Orbit coach</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          {/* Avatar picker */}
          {showAvatarPicker && (
            <div style={{
              background: colors.bg, borderBottom: `1px solid ${colors.border}`,
              padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap',
            }}>
              {AVATARS.map(av => (
                <button
                  key={av.id}
                  onClick={() => { setSelectedAvatar(av); setShowAvatarPicker(false) }}
                  style={{
                    background: av.id === avatar.id ? av.bg : colors.bgCard,
                    border: `1.5px solid ${av.id === avatar.id ? av.accent : colors.border}`,
                    borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
                    color: '#fff', fontSize: 12, fontFamily: 'Nunito, sans-serif', fontWeight: 700,
                    transition: 'all 0.15s',
                  }}
                >
                  {av.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 12px 8px',
            display: 'flex', flexDirection: 'column', gap: 8,
            maxHeight: 320, minHeight: 200,
          }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end', gap: 6,
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: avatar.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 12, flexShrink: 0,
                  }}>
                    {avatar.emoji}
                  </div>
                )}
                <div style={{
                  maxWidth: '78%',
                  background: msg.role === 'user'
                    ? `linear-gradient(135deg, ${colors.accent}, ${colors.accent}cc)`
                    : colors.bg,
                  border: msg.role === 'user' ? 'none' : `1px solid ${colors.border}`,
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '8px 12px',
                  fontSize: 13, color: msg.role === 'user' ? '#fff' : colors.text,
                  lineHeight: 1.45, fontFamily: 'Nunito, sans-serif',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatar.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  {avatar.emoji}
                </div>
                <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '16px 16px 16px 4px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: avatar.accent, animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: `1px solid ${colors.border}`,
            padding: '8px 10px',
            display: 'flex', gap: 8, alignItems: 'center',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={`Ask ${avatar.name}...`}
              style={{
                flex: 1, background: colors.bg, border: `1px solid ${colors.border}`,
                borderRadius: 12, padding: '8px 12px', color: colors.text,
                fontSize: 13, fontFamily: 'Nunito, sans-serif', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? avatar.bg : colors.border,
                border: 'none', borderRadius: 12, width: 36, height: 36,
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 2px ${avatar.accent}55; }
          50% { box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 5px ${avatar.accent}22; }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  )
}
