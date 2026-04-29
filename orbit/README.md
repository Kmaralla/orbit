# 🌌 Orbit — Life Tracking

A full-stack family wellness and life tracking app. Each user signs up, creates their own "orbits" (usecases like Dad's Health, Kids Routine, Career Goals), builds custom checklists, and gets AI-powered weekly trend analysis from Claude.

## Features

- 🔐 **Auth** — Sign up / sign in via Supabase (email + password)
- 🪐 **Orbits** — Create unlimited usecases per user (Dad's Health, Kids, Career, etc.)
- ✅ **Checklists** — Add items with 4 value types: checkbox, score (1-10), number, or text
- 📊 **Stats** — Weekly and monthly completion charts per orbit
- 🤖 **AI Analysis** — Claude generates wins, watch areas, and next steps
- 🔔 **Email Reminders** — Set a daily reminder time per orbit (Supabase Edge Functions)
- 🔒 **Row-Level Security** — Each user only sees their own data

---

## 🚀 Deploy in 4 Steps

### Step 1 — Supabase (database + auth)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** → name it `orbit` → set a database password → Create
3. Once created, go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → click **Run**
4. Go to **Settings → API** and copy:
   - `Project URL` → this is your `VITE_SUPABASE_URL`
   - `anon public` key → this is your `VITE_SUPABASE_ANON_KEY`

### Step 2 — GitHub

1. Create a new repo at [github.com](https://github.com) named `orbit`
2. In your terminal:

```bash
cd orbit
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/orbit.git
git push -u origin main
```

### Step 3 — Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub
2. Click **Add New Project** → import `orbit`
3. Before deploying, open **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | from Supabase settings |
| `VITE_SUPABASE_ANON_KEY` | from Supabase settings |
| `VITE_ANTHROPIC_API_KEY` | from console.anthropic.com |

4. Click **Deploy** — done in ~2 minutes

### Step 4 — Share

Your app will be live at `https://orbit-xxx.vercel.app`

Send family members the link — they sign up themselves and create their own orbits.

---

## 🔔 Email Reminders Setup (Optional)

To enable daily email reminders via [Resend](https://resend.com):

1. Create a free Resend account → get an API key
2. In Supabase → **Edge Functions** → create a function called `send-reminders`
3. Deploy a daily cron that queries usecases with notify_email set and sends reminder emails
4. Full edge function code: see `supabase/send-reminders.ts` (coming soon)

---

## Local Development

```bash
cp .env.example .env
# fill in your values in .env

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Charts | Recharts |
| AI | Anthropic Claude API |
| Hosting | Vercel |
| Fonts | Syne + DM Sans (Google Fonts) |
