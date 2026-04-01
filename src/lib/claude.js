export async function getBuildDayPlan(orbitsWithTasks, answers) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return null

  const context = orbitsWithTasks.map(o => ({
    id: o.id,
    name: o.name,
    icon: o.icon,
    description: o.description || '',
    goal: o.goal_statement || null,
    streakDays: o.streakDays,
    atRisk: o.atRisk,
    checkedTodayCount: o.checkedTodayCount,
    tasks: o.tasks.map(t => ({
      label: t.label,
      type: t.value_type,
      frequency: t.frequency || 'daily',
      checkedToday: t.checkedToday,
    })),
  }))

  const timeMap = { quick: '~15 minutes', normal: '~30 minutes', deep: '60+ minutes' }
  const energyMap = { low: 'low energy / tired', medium: 'moderate energy', high: 'high energy / focused' }

  const prompt = `You help someone build a focused, realistic daily plan from their life-tracking orbits.

ORBITS AND TODAY'S TASKS:
${JSON.stringify(context, null, 2)}

USER CONTEXT TODAY:
- Time available: ${timeMap[answers.time] || answers.time}
- Energy level: ${energyMap[answers.energy] || answers.energy}
- Priority orbits today: ${answers.focusOrbits.length > 0 ? answers.focusOrbits.join(', ') : 'balanced across all'}

RULES:
- For quick (~15 min): pick 4–6 tasks max, prioritize at-risk streaks and simple checkboxes
- For normal (~30 min): 7–10 tasks, balanced across orbits
- For deep (60+ min): can cover most tasks, encourage thoughtful score/text entries
- Low energy: favor simple checkbox tasks, avoid text/score tasks requiring reflection
- High energy: good time for score and text tasks that need real thought
- Each orbit may have a "goal" field — use it to understand WHY this orbit matters and which tasks move the needle toward that goal. Prioritize tasks that directly serve the goal.
- ALWAYS include at-risk streak tasks (atRisk: true) — these should almost never be skipped
- If user named priority orbits, weight them significantly higher
- For each orbit in the plan, select only the most impactful subset of tasks
- Each orbit in plan should have 1–4 tasks, not the entire list
- Skipped orbits need a compassionate one-phrase reason

Respond ONLY with valid JSON, no markdown fences:
{
  "greeting": "one warm sentence acknowledging their energy/time situation today",
  "plan": [
    {
      "orbitId": "uuid",
      "orbitName": "string",
      "orbitIcon": "emoji",
      "priority": "high|medium|low",
      "tasks": ["task label"],
      "reason": "one sentence — why this orbit and these specific tasks today"
    }
  ],
  "skipped": [
    { "orbitName": "string", "orbitIcon": "emoji", "reason": "brief reason" }
  ],
  "summary": "e.g. 7 tasks across 3 orbits — about 25 minutes"
}`

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
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  if (data.error) return null

  const text = data.content?.find(b => b.type === 'text')?.text || ''
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

export async function getOrganizeSuggestions(orbits, completionData) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = `You are a life-optimization advisor. A user has multiple orbits (life areas they track daily) and their completion history. Analyze their data and suggest practical reorganization to match their real bandwidth.

ORBITS AND COMPLETION DATA:
${JSON.stringify(completionData, null, 2)}

RULES:
- Be honest but kind — these are real commitments the user cares about
- Only suggest merging orbits if they are genuinely overlapping in purpose
- "Remove task" means archive it — it shows up too rarely to be worth tracking
- "Change frequency" means a task is being done less often than daily, so scheduling it weekly/weekdays makes more sense
- Cap at 5 total suggestions — prioritize the most impactful ones
- If the data looks healthy, say so and suggest 1-2 refinements at most
- Each suggestion must have a clear reason backed by the data

Respond ONLY with valid JSON:
{
  "headline": "one sentence overall read of the user's orbit health",
  "healthScore": 0-100,
  "suggestions": [
    {
      "type": "remove_task" | "change_frequency" | "merge_orbits" | "pause_orbit" | "spotlight",
      "orbitId": "uuid or null",
      "orbitName": "string",
      "targetOrbitId": "uuid (only for merge_orbits)",
      "taskLabel": "string (only for remove_task / change_frequency)",
      "newFrequency": "weekdays | weekly | custom (only for change_frequency)",
      "title": "short action title",
      "reason": "1-2 sentences backed by data",
      "impact": "what will improve if they do this"
    }
  ]
}`

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
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  if (data.error) return null

  const text = data.content?.find(b => b.type === 'text')?.text || ''
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

export async function getClaudeAnalysis(usecaseName, entries, items) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      trend: "Hey there! It looks like the AI analysis isn't set up yet. But don't worry - you're already doing amazing by tracking your progress! Keep it up!",
      wins: ["You're consistently showing up for yourself", "Taking time to track what matters to you"],
      watchAreas: ["Set up your API key to unlock personalized insights", "Keep building your streak!"],
      nextSteps: ["Add VITE_ANTHROPIC_API_KEY to your .env file", "Complete today's check-in", "Come back for your personalized analysis!"]
    }
  }

  // Build a rich, structured summary of the data
  const summary = items.map(item => {
    const itemEntries = entries.filter(e => e.checklist_item_id === item.id)
    const frequency = item.frequency || 'daily'

    // Calculate completion stats
    const totalEntries = itemEntries.length
    let completedCount = 0
    let avgScore = 0

    if (item.value_type === 'checkbox') {
      completedCount = itemEntries.filter(e => e.value === 'true').length
    } else if (item.value_type === 'score') {
      const scores = itemEntries.map(e => Number(e.value)).filter(n => !isNaN(n))
      avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0
    }

    const values = itemEntries.slice(-7).map(e => `${e.date}: ${e.value}`)
    const statsInfo = item.value_type === 'checkbox'
      ? `completed ${completedCount} times`
      : item.value_type === 'score'
      ? `average score: ${avgScore}/10`
      : `${totalEntries} entries`

    return `- ${item.label} (${item.value_type}, ${frequency}): ${statsInfo}. Recent: ${values.join(', ') || 'no recent data'}`
  }).join('\n')

  const totalItems = items.length
  const itemsWithData = items.filter(item => entries.some(e => e.checklist_item_id === item.id)).length

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
      max_tokens: 1200,
      system: `You are a warm, encouraging personal life coach analyzing someone's progress on their "${usecaseName}" orbit (life area they're tracking).

Your tone should be:
- Friendly and conversational (like a supportive friend)
- Genuinely warm and uplifting
- Specific and intelligent (reference actual data patterns you see)
- Hopeful and motivating without being cheesy
- Celebrate wins big and small
- Gently acknowledge areas for improvement without being harsh

Analyze their check-in data and provide:
1. "trend": A warm, personalized 2-3 sentence overall assessment. Start with gratitude for their effort. Be specific about patterns you notice. End with hope and encouragement.
2. "wins": Array of 2-3 specific wins. Be concrete about what they did well. Celebrate consistency, improvements, and effort.
3. "watchAreas": Array of 2 areas that need gentle attention. Frame these as opportunities, not failures. Be compassionate.
4. "nextSteps": Array of 3 specific, achievable action items. Make them practical and doable. Include at least one easy win.

Remember: The person tracking this cares deeply about it. Make them feel seen, appreciated, and motivated to continue.

Respond ONLY with valid JSON with keys: trend, wins, watchAreas, nextSteps.`,
      messages: [{
        role: 'user',
        content: `Orbit: "${usecaseName}"
Total items being tracked: ${totalItems}
Items with check-in data: ${itemsWithData}

Detailed check-in data:
${summary}

Please analyze this and provide your warm, intelligent analysis as JSON.`
      }]
    })
  })

  const data = await response.json()

  // Check for API errors
  if (data.error) {
    console.error('Claude API error:', data.error)
    return {
      trend: `Hey! I couldn't analyze your data right now, but honestly? The fact that you're tracking "${usecaseName}" at all shows real dedication. That commitment is something to be proud of!`,
      wins: ["You're building awareness by tracking this", "Every check-in is a small victory"],
      watchAreas: ["Try again in a moment for personalized insights", "Keep your streak going!"],
      nextSteps: ["Complete today's check-in", "Refresh and try the analysis again", "Celebrate showing up for yourself!"]
    }
  }

  const text = data.content?.find(b => b.type === 'text')?.text || '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      trend: `You're doing great with "${usecaseName}"! The very act of tracking and reflecting shows real commitment to growth. Keep building on this momentum - small consistent steps lead to big changes.`,
      wins: ["Showing up consistently to track your progress", "Taking intentional action on what matters to you"],
      watchAreas: ["Look for patterns in your highest-performing days", "Notice what helps you stay consistent"],
      nextSteps: ["Complete today's check-in", "Celebrate one small win from this week", "Set an intention for tomorrow"]
    }
  }
}
