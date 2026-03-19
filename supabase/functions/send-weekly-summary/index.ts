// Supabase Edge Function: Send Weekly AI Summary Email
// Schedule: Run every Sunday at 6pm UTC (0 18 * * 0)
// Sends personalized AI-generated weekly summary to users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Usecase {
  id: string
  name: string
  icon: string
  user_id: string
}

interface ChecklistItem {
  id: string
  usecase_id: string
  label: string
  value_type: string
  frequency: string
}

interface Entry {
  checklist_item_id: string
  date: string
  value: string
}

interface UserData {
  email: string
  orbits: {
    name: string
    icon: string
    items: { label: string; value_type: string; entries: { date: string; value: string }[] }[]
  }[]
}

async function getClaudeAnalysis(userData: UserData, anthropicKey: string): Promise<{
  greeting: string
  orbitSummaries: { name: string; icon: string; trend: string; wins: string[]; focusArea: string }[]
  weeklyMotto: string
}> {
  // Build summary for Claude
  const orbitSummaries = userData.orbits.map(orbit => {
    const itemSummaries = orbit.items.map(item => {
      const completedCount = item.entries.filter(e =>
        e.value && e.value !== '' && e.value !== 'false'
      ).length

      if (item.value_type === 'checkbox') {
        return `  - ${item.label}: completed ${completedCount}/7 days`
      } else if (item.value_type === 'score') {
        const scores = item.entries.map(e => Number(e.value)).filter(n => !isNaN(n) && n > 0)
        const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'no data'
        return `  - ${item.label}: avg score ${avg}/10 (${scores.length} entries)`
      } else if (item.value_type === 'number') {
        const nums = item.entries.map(e => Number(e.value)).filter(n => !isNaN(n))
        const total = nums.reduce((a, b) => a + b, 0)
        return `  - ${item.label}: total ${total} (${nums.length} entries)`
      } else {
        return `  - ${item.label}: ${item.entries.length} text entries`
      }
    }).join('\n')

    return `${orbit.icon} ${orbit.name}:\n${itemSummaries}`
  }).join('\n\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are a warm, encouraging life coach creating a weekly summary email for someone tracking their life goals.

Write in a warm, personal tone - like a supportive friend who genuinely cares about their progress.

Return ONLY valid JSON with:
{
  "greeting": "A warm 1-2 sentence personalized greeting acknowledging their week",
  "orbitSummaries": [
    {
      "name": "orbit name",
      "icon": "emoji",
      "trend": "1-2 sentence warm summary of how they did this week",
      "wins": ["specific win 1", "specific win 2"],
      "focusArea": "one gentle suggestion for next week"
    }
  ],
  "weeklyMotto": "An inspiring 1-sentence motto for the coming week"
}`,
      messages: [{
        role: 'user',
        content: `Here's this user's check-in data for the past 7 days:\n\n${orbitSummaries}\n\nPlease create their weekly summary.`
      }]
    })
  })

  const data = await response.json()
  const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'

  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    // Fallback if parsing fails
    return {
      greeting: "Hey! Another week of tracking your progress - that's commitment! 🌟",
      orbitSummaries: userData.orbits.map(o => ({
        name: o.name,
        icon: o.icon,
        trend: "You showed up this week, and that's what matters most.",
        wins: ["Consistency in tracking", "Taking time for self-reflection"],
        focusArea: "Keep building on your momentum!"
      })),
      weeklyMotto: "Small steps, big changes. You've got this! 💪"
    }
  }
}

function buildEmailHtml(analysis: Awaited<ReturnType<typeof getClaudeAnalysis>>, appUrl: string): string {
  const orbitSections = analysis.orbitSummaries.map(orbit => `
    <tr>
      <td style="padding: 20px 0; border-bottom: 1px solid #1a1a2e;">
        <div style="font-size: 24px; margin-bottom: 8px;">${orbit.icon}</div>
        <div style="font-size: 18px; font-weight: 700; color: #e8e4f0; margin-bottom: 8px;">
          ${orbit.name}
        </div>
        <div style="font-size: 14px; color: #b8b4c8; line-height: 1.6; margin-bottom: 12px;">
          ${orbit.trend}
        </div>
        <div style="margin-bottom: 12px;">
          ${orbit.wins.map(win => `
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <span style="color: #22c55e; margin-right: 8px;">✓</span>
              <span style="color: #a8a4b8; font-size: 13px;">${win}</span>
            </div>
          `).join('')}
        </div>
        <div style="background: #6c63ff22; border-left: 3px solid #6c63ff; padding: 10px 14px; border-radius: 0 8px 8px 0;">
          <span style="color: #8b85ff; font-size: 12px; font-weight: 600;">FOCUS FOR NEXT WEEK:</span>
          <div style="color: #c8c4d8; font-size: 13px; margin-top: 4px;">${orbit.focusArea}</div>
        </div>
      </td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #080810; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #080810; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 700; color: #e8e4f0;">
                      <span style="color: #6c63ff;">●</span> Orbit
                    </span>
                  </td>
                  <td style="text-align: right; color: #4a4870; font-size: 13px;">
                    Weekly Summary
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding-bottom: 24px;">
              <h1 style="color: #e8e4f0; font-size: 22px; font-weight: 600; margin: 0 0 12px 0;">
                Your Week in Review 📊
              </h1>
              <p style="color: #8b87a8; font-size: 15px; margin: 0; line-height: 1.6;">
                ${analysis.greeting}
              </p>
            </td>
          </tr>

          <!-- Orbit Summaries -->
          <tr>
            <td style="background-color: #0d0d1a; border-radius: 16px; border: 1px solid #1a1a2e; padding: 8px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${orbitSections}
              </table>
            </td>
          </tr>

          <!-- Weekly Motto -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <div style="background: linear-gradient(135deg, #6c63ff22 0%, #6c63ff11 100%); border: 1px solid #6c63ff44; border-radius: 12px; padding: 20px;">
                <div style="color: #6c63ff; font-size: 12px; font-weight: 600; margin-bottom: 8px;">
                  YOUR MOTTO FOR THE WEEK
                </div>
                <div style="color: #e8e4f0; font-size: 16px; font-weight: 500; line-height: 1.5;">
                  "${analysis.weeklyMotto}"
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <a href="${appUrl}/dashboard"
                 style="display: inline-block; background: linear-gradient(135deg, #6c63ff 0%, #5b54e0 100%);
                        color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none;
                        font-size: 14px; font-weight: 600;">
                Start Your New Week →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="color: #3a3858; font-size: 11px; margin: 0;">
                You're receiving this because you enabled weekly summaries.<br>
                <a href="${appUrl}/dashboard" style="color: #4a4870; text-decoration: none;">Manage notification settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'https://www.orbityours.com'

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY')
    }
    if (!anthropicApiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for test mode
    let forceAll = false
    try {
      const body = await req.json()
      if (body?.test === true) forceAll = true
    } catch {
      // No body
    }

    // Log start
    await supabase.from('function_logs').insert({
      function_name: 'send-weekly-summary',
      status: 'started',
      details: { testMode: forceAll, timestamp: new Date().toISOString() }
    })

    // Get all usecases with email reminders (these users want notifications)
    const { data: usecases, error: fetchError } = await supabase
      .from('usecases')
      .select('id, name, icon, user_id, notify_email')
      .not('notify_email', 'is', null)

    if (fetchError) throw fetchError

    if (!usecases || usecases.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No users with email reminders', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by user email
    const userOrbits: Record<string, { email: string; orbits: Usecase[] }> = {}
    for (const uc of usecases) {
      if (!userOrbits[uc.user_id]) {
        userOrbits[uc.user_id] = { email: uc.notify_email, orbits: [] }
      }
      userOrbits[uc.user_id].orbits.push(uc)
    }

    // Get all orbit IDs
    const allOrbitIds = usecases.map(uc => uc.id)

    // Get checklist items
    const { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .in('usecase_id', allOrbitIds)

    // Get entries from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { data: entries } = await supabase
      .from('checkin_entries')
      .select('checklist_item_id, date, value')
      .in('checklist_item_id', items?.map(i => i.id) || [])
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])

    const results: { email: string; status: string; orbitCount: number; error?: string }[] = []
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (const userId of Object.keys(userOrbits)) {
      const userData = userOrbits[userId]
      const email = userData.email

      // Build user's data structure
      const userDataForAI: UserData = {
        email,
        orbits: userData.orbits.map(orbit => {
          const orbitItems = items?.filter(i => i.usecase_id === orbit.id) || []
          return {
            name: orbit.name,
            icon: orbit.icon,
            items: orbitItems.map(item => ({
              label: item.label,
              value_type: item.value_type,
              entries: entries
                ?.filter(e => e.checklist_item_id === item.id)
                .map(e => ({ date: e.date, value: e.value })) || []
            }))
          }
        })
      }

      try {
        // Get AI analysis
        const analysis = await getClaudeAnalysis(userDataForAI, anthropicApiKey)

        // Build and send email
        const emailHtml = buildEmailHtml(analysis, appUrl)

        // Rate limit: wait between API calls
        await sleep(2000)

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Orbit <weekly@orbityours.com>',
            to: email,
            subject: `📊 Your Week in Review — ${userData.orbits.length} orbit${userData.orbits.length > 1 ? 's' : ''}`,
            html: emailHtml,
          }),
        })

        const emailResult = await emailResponse.json()

        if (!emailResponse.ok) {
          console.error(`Failed to send to ${email}:`, emailResult)
          results.push({ email, status: 'failed', orbitCount: userData.orbits.length, error: emailResult.message })
        } else {
          console.log(`✓ Weekly summary sent to ${email}`)
          results.push({ email, status: 'sent', orbitCount: userData.orbits.length })
        }
      } catch (err: any) {
        console.error(`Error processing ${email}:`, err.message)
        results.push({ email, status: 'error', orbitCount: userData.orbits.length, error: err.message })
      }

      // Rate limit between users
      await sleep(10000)
    }

    const sent = results.filter(r => r.status === 'sent').length
    const failed = results.filter(r => r.status !== 'sent').length

    // Log completion
    await supabase.from('function_logs').insert({
      function_name: 'send-weekly-summary',
      status: 'success',
      details: { testMode: forceAll, sent, failed, totalUsers: Object.keys(userOrbits).length }
    })

    return new Response(
      JSON.stringify({ success: true, sent, failed, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
