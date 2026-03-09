export async function getClaudeAnalysis(usecaseName, entries, items) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  // Build a structured summary of the data
  const summary = items.map(item => {
    const itemEntries = entries.filter(e => e.checklist_item_id === item.id)
    const values = itemEntries.map(e => `${e.date}: ${e.value}`)
    return `${item.label} (${item.value_type}): ${values.join(', ') || 'no data'}`
  }).join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a personal life coach and analyst. Analyze check-in data and provide:
1. A brief overall trend assessment (2-3 sentences)
2. Top 2 wins / positives this period
3. Top 2 areas needing attention
4. 3 specific, actionable next steps

Be warm, specific, and encouraging. Respond in JSON with keys: trend, wins (array), watchAreas (array), nextSteps (array).`,
      messages: [{
        role: 'user',
        content: `Usecase: "${usecaseName}"\n\nCheck-in data for the past period:\n${summary}\n\nProvide analysis as JSON only.`
      }]
    })
  })

  const data = await response.json()
  const text = data.content?.find(b => b.type === 'text')?.text || '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      trend: "Great consistency with your check-ins! Keep building on this momentum.",
      wins: ["Showing up consistently", "Tracking your progress"],
      watchAreas: ["Review items with lower scores", "Look for weekly patterns"],
      nextSteps: ["Complete today's check-in", "Review last week's trends", "Adjust goals as needed"]
    }
  }
}
