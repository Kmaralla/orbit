# Orbit — Life Tracking App
## Claude Code Context File

Use this file when opening the project in Claude Code. It gives Claude full context to help you enhance the app.

---

## What This App Does

**Orbit** is a full-stack family life tracking app where each user:
1. Signs up / logs in with their own account
2. Creates "orbits" (usecases) — e.g. Dad's Health, Kids Routine, Career Goals
3. Adds checklist items to each orbit with 4 value types: checkbox, score (1–10), number, or text
4. Does a daily check-in for each orbit
5. Views weekly/monthly stats with bar charts
6. Gets AI-powered trend analysis from Claude (wins, watch areas, next steps)

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + Vite | SPA, no Next.js |
| Routing | React Router v6 | |
| Database + Auth | Supabase | Postgres, row-level security |
| Charts | Recharts | BarChart on Stats page |
| AI Analysis | Anthropic Claude API | `claude-sonnet-4-20250514` |
| Hosting | Vercel | Auto-deploy from GitHub |
| Fonts | Syne + DM Sans | via Google Fonts in index.html |

---

## Project Structure

```
orbit/
├── index.html                  # Google Fonts loaded here
├── vite.config.js
├── package.json
├── .env.example                # Copy to .env and fill in keys
├── supabase/
│   └── schema.sql              # Run this in Supabase SQL Editor once
└── src/
    ├── main.jsx                # React root
    ├── App.jsx                 # Router + ProtectedRoute
    ├── hooks/
    │   └── useAuth.jsx         # Auth context (user, loading)
    ├── lib/
    │   ├── supabase.js         # Supabase client
    │   └── claude.js           # Claude API call for trend analysis
    ├── pages/
    │   ├── Landing.jsx         # Split-panel login/signup page
    │   ├── Dashboard.jsx       # Grid of all orbits, today's status
    │   ├── Usecase.jsx         # Daily check-in for one orbit
    │   └── Stats.jsx           # Charts + Claude AI analysis
    └── components/
        ├── Navbar.jsx          # Top nav with logo + signout
        └── AddUsecase.jsx      # Modal to create a new orbit
```

---

## Environment Variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
VITE_ANTHROPIC_API_KEY=your-anthropic-key
```

---

## Database Schema (Supabase)

```sql
-- 3 tables, all with Row Level Security enabled

usecases
  id uuid PK
  user_id uuid → auth.users
  name text
  description text
  icon text (emoji)
  notify_email text (for reminders)
  notify_time time
  created_at timestamptz

checklist_items
  id uuid PK
  usecase_id uuid → usecases
  label text
  description text
  value_type text  -- 'checkbox' | 'score' | 'number' | 'text'
  sort_order int
  created_at timestamptz

checkin_entries
  id uuid PK
  checklist_item_id uuid → checklist_items
  user_id uuid → auth.users
  date date
  value text
  created_at timestamptz
  UNIQUE(checklist_item_id, user_id, date)
```

---

## Key Design Decisions

- **All inline styles** — no CSS files or Tailwind. Styles are JS objects in each component.
- **Color palette**: bg `#080810`, card `#0d0d1a`, accent `#6c63ff` (purple), text `#e8e4f0`
- **Fonts**: `Syne` for headings/logo (bold, geometric), `DM Sans` for body
- **RLS**: Users can only read/write their own rows — enforced at DB level
- **No backend** — all Supabase queries run directly from the browser using the anon key + RLS
- **Claude API called client-side** — `VITE_ANTHROPIC_API_KEY` is exposed in the browser bundle (acceptable for personal/family use; for production, proxy through a backend)

---

## Planned Enhancements (Backlog)

### High Priority
- [ ] **Email reminders** — Supabase Edge Function + Resend.com to send daily check-in emails at `notify_time`
- [ ] **Shareable links** — `?persona=dad` style URL so family members get direct link to their orbit
- [ ] **Streak tracking** — count consecutive days with completed check-ins
- [ ] **Mobile responsive** — Landing page uses CSS grid `1fr 1fr` which breaks on mobile

### Medium Priority
- [ ] **Edit orbit** — currently no way to rename/change icon after creation
- [ ] **Reorder checklist items** — drag-and-drop sort_order
- [ ] **Weekly email digest** — Claude-generated weekly summary emailed to user
- [ ] **Push notifications** — browser push or PWA for daily reminders
- [ ] **Dark/light theme toggle**

### Low Priority
- [ ] **Export data** — download CSV of all entries
- [ ] **Multiple users per orbit** — e.g. parent tracks child's orbit
- [ ] **Templates** — pre-built orbit templates (Dad Health, Kids, Fitness, etc.)
- [ ] **Supabase Realtime** — live updates when family member completes check-in

---

## How to Run Locally

```bash
# 1. Install deps
npm install

# 2. Copy env file and fill in your keys
cp .env.example .env

# 3. Start dev server
npm run dev
# → http://localhost:5173
```

---

## How to Deploy

```bash
# Build for production
npm run build
# → dist/ folder

# Or just push to GitHub — Vercel auto-deploys on every push to main
git add . && git commit -m "your changes" && git push
```

---

## Common Claude Code Tasks

When working on this project with Claude Code, here are useful prompts:

```
"Add mobile responsive styles to Landing.jsx — the grid should stack on screens under 768px"

"Build a Supabase Edge Function in supabase/functions/send-reminders/ that queries usecases with notify_email set and sends a reminder email via Resend API"

"Add a streak counter to Dashboard.jsx — query checkin_entries to count consecutive days with at least one entry per orbit"

"Add drag-to-reorder to Usecase.jsx checklist items using the HTML5 drag API and update sort_order in Supabase"

"Add an Edit button to each orbit card on Dashboard.jsx that opens AddUsecase modal pre-filled with existing data"

"Move the Anthropic API call in claude.js to a Vercel serverless function at api/analyze.js so the API key isn't exposed client-side"
```

---

## Security Notes

- The `VITE_ANTHROPIC_API_KEY` is currently called client-side — fine for family use but exposed in the JS bundle
- To fix for public production: create `api/analyze.js` as a Vercel serverless function, move the fetch there, and call `/api/analyze` from the frontend instead
- Supabase RLS policies ensure data isolation — each user truly cannot access other users' data even if they try to query directly

---

## Supabase Edge Function Skeleton (Email Reminders)

```typescript
// supabase/functions/send-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`

  // Find usecases with reminders due now
  const { data: usecases } = await supabase
    .from('usecases')
    .select('*, users:user_id(email)')
    .eq('notify_time', currentTime)
    .not('notify_email', 'is', null)

  for (const uc of usecases ?? []) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'orbit@yourdomain.com',
        to: uc.notify_email,
        subject: `⏰ Time for your ${uc.name} check-in`,
        html: `<p>Hey! Don't forget your daily <strong>${uc.name}</strong> check-in.</p>
               <a href="https://your-app.vercel.app/usecase/${uc.id}">Check in now →</a>`
      })
    })
  }

  return new Response('done')
})
```

Deploy with: `supabase functions deploy send-reminders`
Schedule with: Supabase Dashboard → Edge Functions → Schedules → `*/5 * * * *` (every 5 min)
