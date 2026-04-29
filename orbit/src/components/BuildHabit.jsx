import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'

const HABIT_ICONS = {
  fitness: '💪',
  health: '❤️',
  meditation: '🧘',
  reading: '📚',
  learning: '🎯',
  productivity: '⚡',
  sleep: '😴',
  nutrition: '🥗',
  mindfulness: '🧠',
  creativity: '🎨',
  finance: '💰',
  social: '👥',
  default: '✨'
}

export default function BuildHabit({ onClose, onCreated, userId }) {
  const { colors } = useTheme()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [habit, setHabit] = useState('')
  const [motivation, setMotivation] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [generatedOrbit, setGeneratedOrbit] = useState(null)
  const [error, setError] = useState('')

  const steps = [
    { question: "What habit do you want to build?", placeholder: "e.g., Exercise more, Read daily, Meditate..." },
    { question: "Why is this important to you?", placeholder: "e.g., Feel healthier, Reduce stress, Learn new skills..." },
    { question: "How often do you want to track this?", type: "frequency" },
  ]

  const generateOrbit = async () => {
    setLoading(true)
    setError('')

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fallback: create simple orbit without AI
      const icon = detectIcon(habit)
      setGeneratedOrbit({
        name: habit,
        icon,
        description: motivation,
        items: [
          { label: `Complete ${habit.toLowerCase()}`, type: 'checkbox' },
          { label: 'How do you feel? (1-10)', type: 'score' },
          { label: 'Notes', type: 'text' }
        ]
      })
      setLoading(false)
      setStep(3)
      return
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          system: `You help people build habits by creating tracking systems. Given a habit and motivation, create a simple orbit (tracking system) with 3-5 checklist items.

Return ONLY valid JSON:
{
  "name": "Short catchy name for the orbit (2-4 words)",
  "icon": "single emoji that fits the habit",
  "description": "One encouraging sentence about this habit journey",
  "items": [
    { "label": "What to track", "type": "checkbox|score|number|text", "description": "Optional helper text" }
  ]
}

Types:
- checkbox: Yes/no daily tasks
- score: Rate 1-10 (mood, energy, etc.)
- number: Count something (minutes, reps, pages)
- text: Journal/notes

Keep it simple and achievable. 3-5 items max. Make labels friendly and motivating.`,
          messages: [{
            role: 'user',
            content: `Habit: ${habit}
Why it matters: ${motivation}
Frequency: ${frequency}

Create a simple tracking orbit for this habit.`
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.find(b => b.type === 'text')?.text || '{}'
      const clean = text.replace(/```json|```/g, '').trim()
      const orbit = JSON.parse(clean)

      setGeneratedOrbit(orbit)
      setStep(3)
    } catch (err) {
      console.error('AI generation failed:', err)
      // Fallback
      const icon = detectIcon(habit)
      setGeneratedOrbit({
        name: habit,
        icon,
        description: motivation,
        items: [
          { label: `Complete ${habit.toLowerCase()}`, type: 'checkbox' },
          { label: 'How do you feel? (1-10)', type: 'score' },
          { label: 'Notes', type: 'text' }
        ]
      })
      setStep(3)
    }
    setLoading(false)
  }

  const detectIcon = (text) => {
    const lower = text.toLowerCase()
    if (lower.includes('exercise') || lower.includes('workout') || lower.includes('gym') || lower.includes('fitness')) return HABIT_ICONS.fitness
    if (lower.includes('meditat') || lower.includes('mindful') || lower.includes('breath')) return HABIT_ICONS.meditation
    if (lower.includes('read') || lower.includes('book')) return HABIT_ICONS.reading
    if (lower.includes('learn') || lower.includes('study') || lower.includes('skill')) return HABIT_ICONS.learning
    if (lower.includes('sleep') || lower.includes('rest') || lower.includes('wake')) return HABIT_ICONS.sleep
    if (lower.includes('eat') || lower.includes('diet') || lower.includes('nutrition') || lower.includes('food')) return HABIT_ICONS.nutrition
    if (lower.includes('health') || lower.includes('wellness')) return HABIT_ICONS.health
    if (lower.includes('creat') || lower.includes('art') || lower.includes('write') || lower.includes('draw')) return HABIT_ICONS.creativity
    if (lower.includes('money') || lower.includes('save') || lower.includes('budget') || lower.includes('financ')) return HABIT_ICONS.finance
    if (lower.includes('social') || lower.includes('friend') || lower.includes('family') || lower.includes('connect')) return HABIT_ICONS.social
    if (lower.includes('product') || lower.includes('focus') || lower.includes('work')) return HABIT_ICONS.productivity
    return HABIT_ICONS.default
  }

  const createOrbit = async () => {
    setLoading(true)
    setError('')

    try {
      // Create the orbit
      const { data: orbit, error: orbitError } = await supabase
        .from('usecases')
        .insert({
          user_id: userId,
          name: generatedOrbit.name,
          icon: generatedOrbit.icon,
          description: generatedOrbit.description
        })
        .select()
        .single()

      if (orbitError) throw orbitError

      // Create checklist items
      const items = generatedOrbit.items.map((item, idx) => ({
        usecase_id: orbit.id,
        label: item.label,
        description: item.description || '',
        value_type: item.type,
        frequency: frequency,
        sort_order: idx
      }))

      const { error: itemsError } = await supabase
        .from('checklist_items')
        .insert(items)

      if (itemsError) throw itemsError

      onCreated(orbit)
    } catch (err) {
      console.error('Failed to create orbit:', err)
      setError('Failed to create orbit. Please try again.')
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step === 0 && !habit.trim()) return
    if (step === 1 && !motivation.trim()) return

    if (step === 2) {
      generateOrbit()
    } else {
      setStep(step + 1)
    }
  }

  const s = {
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    },
    modal: {
      background: colors.bgCard,
      borderRadius: 24,
      width: '100%',
      maxWidth: 480,
      maxHeight: '90vh',
      overflow: 'auto',
      border: `1px solid ${colors.border}`,
    },
    header: {
      padding: '24px 24px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontFamily: 'Nunito, sans-serif',
      fontSize: 20,
      fontWeight: 700,
      color: colors.text,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: 24,
      color: colors.textDim,
      cursor: 'pointer',
      padding: 4,
    },
    body: {
      padding: 24,
    },
    progress: {
      display: 'flex',
      gap: 8,
      marginBottom: 24,
    },
    progressDot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      background: colors.border,
      transition: 'background 0.3s',
    },
    question: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.text,
      marginBottom: 16,
      lineHeight: 1.4,
    },
    input: {
      width: '100%',
      padding: '14px 16px',
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.text,
      fontSize: 15,
      fontFamily: 'inherit',
      outline: 'none',
      marginBottom: 16,
    },
    textarea: {
      width: '100%',
      padding: '14px 16px',
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.text,
      fontSize: 15,
      fontFamily: 'inherit',
      outline: 'none',
      marginBottom: 16,
      minHeight: 80,
      resize: 'none',
    },
    freqOptions: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    freqBtn: {
      flex: 1,
      minWidth: 100,
      padding: '12px 16px',
      borderRadius: 10,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    freqBtnActive: {
      background: colors.accent,
      borderColor: colors.accent,
      color: '#fff',
    },
    nextBtn: {
      width: '100%',
      padding: '14px 24px',
      borderRadius: 12,
      border: 'none',
      background: colors.accentGradient,
      color: '#fff',
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'Nunito, sans-serif',
      opacity: loading ? 0.7 : 1,
    },
    backBtn: {
      background: 'none',
      border: 'none',
      color: colors.textDim,
      fontSize: 14,
      cursor: 'pointer',
      marginTop: 12,
      display: 'block',
      margin: '12px auto 0',
    },
    preview: {
      background: colors.bg,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
    },
    previewHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    previewIcon: {
      fontSize: 36,
    },
    previewName: {
      fontSize: 18,
      fontWeight: 700,
      color: colors.text,
    },
    previewDesc: {
      fontSize: 13,
      color: colors.textDim,
      marginBottom: 16,
    },
    previewItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: `1px solid ${colors.border}`,
    },
    previewItemIcon: {
      width: 24,
      height: 24,
      borderRadius: 6,
      background: colors.accent + '22',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      color: colors.accent,
    },
    previewItemLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    previewItemType: {
      fontSize: 11,
      color: colors.textDim,
      background: colors.border,
      padding: '2px 8px',
      borderRadius: 4,
    },
    error: {
      color: '#ff6b6b',
      fontSize: 13,
      marginBottom: 12,
      textAlign: 'center',
    },
    loadingText: {
      textAlign: 'center',
      color: colors.textDim,
      fontSize: 14,
      padding: 40,
    },
    sparkle: {
      display: 'inline-block',
      animation: 'pulse 1s ease infinite',
    }
  }

  const typeIcons = {
    checkbox: '☑️',
    score: '⭐',
    number: '🔢',
    text: '📝'
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.title}>
            <span>✨</span> Build a Habit
          </div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.body}>
          {/* Progress dots */}
          <div style={s.progress}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  ...s.progressDot,
                  background: i <= step ? colors.accent : colors.border
                }}
              />
            ))}
          </div>

          {/* Step 0: What habit */}
          {step === 0 && (
            <>
              <div style={s.question}>What habit do you want to build? 🌱</div>
              <input
                style={s.input}
                placeholder="e.g., Exercise daily, Read more books..."
                value={habit}
                onChange={e => setHabit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                autoFocus
              />
              <button
                style={{ ...s.nextBtn, opacity: habit.trim() ? 1 : 0.5 }}
                onClick={handleNext}
                disabled={!habit.trim()}
              >
                Continue →
              </button>
            </>
          )}

          {/* Step 1: Why */}
          {step === 1 && (
            <>
              <div style={s.question}>Why is "{habit}" important to you? 💭</div>
              <textarea
                style={s.textarea}
                placeholder="This helps us create meaningful tracking items..."
                value={motivation}
                onChange={e => setMotivation(e.target.value)}
                autoFocus
              />
              <button
                style={{ ...s.nextBtn, opacity: motivation.trim() ? 1 : 0.5 }}
                onClick={handleNext}
                disabled={!motivation.trim()}
              >
                Continue →
              </button>
              <button style={s.backBtn} onClick={() => setStep(0)}>← Back</button>
            </>
          )}

          {/* Step 2: Frequency */}
          {step === 2 && (
            <>
              <div style={s.question}>How often do you want to track this? 📅</div>
              <div style={s.freqOptions}>
                {[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekdays', label: 'Weekdays' },
                  { value: 'weekly', label: 'Weekly' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    style={{
                      ...s.freqBtn,
                      ...(frequency === opt.value ? s.freqBtnActive : {})
                    }}
                    onClick={() => setFrequency(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button style={s.nextBtn} onClick={handleNext} disabled={loading}>
                {loading ? (
                  <span style={s.sparkle}>✨ Creating your orbit...</span>
                ) : (
                  'Create My Orbit →'
                )}
              </button>
              <button style={s.backBtn} onClick={() => setStep(1)}>← Back</button>
            </>
          )}

          {/* Step 3: Preview & Confirm */}
          {step === 3 && generatedOrbit && (
            <>
              <div style={s.question}>Here's your habit orbit! 🎉</div>

              <div style={s.preview}>
                <div style={s.previewHeader}>
                  <span style={s.previewIcon}>{generatedOrbit.icon}</span>
                  <span style={s.previewName}>{generatedOrbit.name}</span>
                </div>
                <div style={s.previewDesc}>{generatedOrbit.description}</div>

                {generatedOrbit.items.map((item, idx) => (
                  <div key={idx} style={{
                    ...s.previewItem,
                    borderBottom: idx === generatedOrbit.items.length - 1 ? 'none' : s.previewItem.borderBottom
                  }}>
                    <span style={s.previewItemIcon}>{typeIcons[item.type] || '📋'}</span>
                    <span style={s.previewItemLabel}>{item.label}</span>
                    <span style={s.previewItemType}>{item.type}</span>
                  </div>
                ))}
              </div>

              {error && <div style={s.error}>{error}</div>}

              <button style={s.nextBtn} onClick={createOrbit} disabled={loading}>
                {loading ? 'Creating...' : '🚀 Start This Habit'}
              </button>
              <button style={s.backBtn} onClick={() => setStep(2)}>← Change options</button>
            </>
          )}

          {/* Loading state */}
          {loading && step === 2 && (
            <div style={s.loadingText}>
              <span style={s.sparkle}>✨</span> Orbit AI is crafting your orbit...
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
