// Snooze reminder edge function
// Called via link in reminder email: /snooze-reminder?uid=USER_ID&hours=2
// Sets snoozed_until on all user's orbits, returns a friendly HTML page

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const htmlPage = (title: string, emoji: string, body: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080810; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #0d0d1a; border: 1px solid #1e1e3a; border-radius: 20px;
            padding: 40px 32px; max-width: 400px; width: 100%; text-align: center; }
    .emoji { font-size: 52px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; color: #e8e4f0; margin-bottom: 10px; }
    .body { font-size: 15px; color: #6b6890; line-height: 1.6; margin-bottom: 28px; }
    .btn { display: inline-block; background: #6c63ff; color: #fff; padding: 12px 28px;
           border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 600; }
    .logo { font-size: 14px; color: #3a3858; margin-top: 28px; }
    .logo span { color: #6c63ff; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <div class="title">${title}</div>
    <div class="body">${body}</div>
    <a class="btn" href="https://www.orbityours.com/dashboard">Open Orbit →</a>
    <div class="logo"><span>●</span> Orbit</div>
  </div>
</body>
</html>`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const uid = url.searchParams.get('uid')
    const hours = parseInt(url.searchParams.get('hours') || '2', 10)

    if (!uid) {
      return new Response(
        htmlPage('Invalid link', '⚠️', 'This snooze link is missing required info. Try again from your reminder email.'),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (isNaN(hours) || hours < 1 || hours > 24) {
      return new Response(
        htmlPage('Invalid snooze duration', '⚠️', 'Snooze must be between 1 and 24 hours.'),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('usecases')
      .update({ snoozed_until: snoozeUntil })
      .eq('user_id', uid)

    if (error) {
      console.error('Snooze error:', error)
      return new Response(
        htmlPage('Something went wrong', '😕', 'We couldn\'t snooze your reminder. Please try again.'),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const snoozeTime = new Date(snoozeUntil)
    const timeStr = snoozeTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

    return new Response(
      htmlPage(
        `Snoozed for ${hours} hour${hours > 1 ? 's' : ''}`,
        '⏰',
        `Got it — we'll remind you again around <strong style="color:#e8e4f0">${timeStr}</strong>.<br><br>Your streaks are safe. Take your time.`
      ),
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      htmlPage('Something went wrong', '😕', 'An unexpected error occurred. Please try again.'),
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
})
