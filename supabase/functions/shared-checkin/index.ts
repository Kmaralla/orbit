// Edge Function: shared-checkin
// GET  /shared-checkin?token=xxx        → fetch orbit + items + today's entries
// POST /shared-checkin  { token, entries: [{itemId, value}] } → save check-ins

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    // ── GET: fetch orbit data by token ─────────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')
      if (!token) return json({ error: 'Missing token' }, 400)

      // Validate token
      const { data: share } = await supabase
        .from('orbit_share_tokens')
        .select('orbit_id, owner_user_id, expires_at, last_used_at')
        .eq('token', token)
        .single()

      if (!share) return json({ error: 'Link not found' }, 404)
      if (new Date(share.expires_at) < new Date()) return json({ error: 'Link has expired' }, 410)

      // Fetch orbit
      const { data: orbit } = await supabase
        .from('usecases')
        .select('id, name, icon, description, goal_statement')
        .eq('id', share.orbit_id)
        .is('closed_at', null)
        .single()

      if (!orbit) return json({ error: 'Orbit not found or closed' }, 404)

      // Fetch checklist items
      const { data: items } = await supabase
        .from('checklist_items')
        .select('id, label, value_type')
        .eq('usecase_id', orbit.id)
        .order('created_at')

      // Fetch today's existing entries for this orbit
      const today = new Date().toISOString().split('T')[0]
      const itemIds = (items || []).map((i: any) => i.id)
      const { data: entries } = itemIds.length
        ? await supabase
            .from('checkin_entries')
            .select('checklist_item_id, value')
            .in('checklist_item_id', itemIds)
            .eq('date', today)
            .eq('user_id', share.owner_user_id)
        : { data: [] }

      // Update last_used_at (fire and forget)
      supabase
        .from('orbit_share_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('token', token)
        .then(() => {})

      const entryMap: Record<string, string> = {}
      ;(entries || []).forEach((e: any) => { entryMap[e.checklist_item_id] = e.value })

      return json({ orbit, items: items || [], entries: entryMap, today, expiresAt: share.expires_at })
    }

    // ── POST: save guest check-in entries ──────────────────────────────────
    if (req.method === 'POST') {
      const body = await req.json()
      const { token, entries } = body // entries: [{ itemId, value }]

      if (!token || !Array.isArray(entries) || entries.length === 0) {
        return json({ error: 'Missing token or entries' }, 400)
      }

      // Validate token
      const { data: share } = await supabase
        .from('orbit_share_tokens')
        .select('orbit_id, owner_user_id, expires_at')
        .eq('token', token)
        .single()

      if (!share) return json({ error: 'Link not found' }, 404)
      if (new Date(share.expires_at) < new Date()) return json({ error: 'Link has expired' }, 410)

      // Verify all items belong to this orbit (security check)
      const itemIds = entries.map((e: any) => e.itemId)
      const { data: validItems } = await supabase
        .from('checklist_items')
        .select('id')
        .eq('usecase_id', share.orbit_id)
        .in('id', itemIds)

      const validIds = new Set((validItems || []).map((i: any) => i.id))
      const safeEntries = entries.filter((e: any) => validIds.has(e.itemId))

      if (!safeEntries.length) return json({ error: 'No valid items' }, 400)

      const today = new Date().toISOString().split('T')[0]

      // Upsert entries under owner's user_id (service role bypasses RLS)
      const rows = safeEntries.map((e: any) => ({
        checklist_item_id: e.itemId,
        user_id: share.owner_user_id,
        date: today,
        value: String(e.value),
      }))

      const { error } = await supabase
        .from('checkin_entries')
        .upsert(rows, { onConflict: 'checklist_item_id,user_id,date' })

      if (error) return json({ error: error.message }, 500)

      // Update last_used_at
      await supabase
        .from('orbit_share_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('token', token)

      return json({ success: true, saved: safeEntries.length })
    }

    return json({ error: 'Method not allowed' }, 405)

  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
