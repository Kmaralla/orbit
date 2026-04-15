/**
 * Smart Today's Focus engine
 *
 * Understands the *intention* of each orbit and task — not just streak numbers.
 * Scores every uncompleted, scheduled task on:
 *   1. Orbit category (health > family > fitness > career > other)
 *   2. Behavioral state (protect streak / re-engage / dormant / never started / maintain)
 *   3. Habit momentum (completion rate: last 14 days vs prior 14 days)
 *   4. Absence signal (days since last check-in)
 *
 * Generates a narrative that explains *why* today matters, grounded only in real data.
 *
 * Called from Dashboard.jsx after streaks are already computed.
 * Input: Array of { item, orbit, streak, itemEntries, today }
 */

// ── Orbit intent detection ────────────────────────────────────────────────────

const HEALTH_WORDS  = /health|medic|sleep|diet|nutri|doctor|therap|wellness|blood|heart|diabet|breath|stress|anxiety|vitamin|prescri|mental/
const FAMILY_WORDS  = /famil|kid|child|son|daughter|dad|mom|parent|wife|husband|spouse|relation|partner|marriage|togeth/
const FITNESS_WORDS = /fitness|workout|gym|exercise|run|walk|sport|train|yoga|lift|cardio|steps|cycling|swim|stretch|jog/
const CAREER_WORDS  = /career|work|job|profess|business|skill|learn|study|read|course|certif|goal|product|focus|build/

const HEALTH_ICONS  = new Set(['❤️','🫀','🩺','💊','🏥','🧠','😴','🥗','🧘','💆','🦷','💉','🩸'])
const FAMILY_ICONS  = new Set(['👴','👧','👦','👨','👩','🏠','👶','🧒','👪','👫','🤱'])
const FITNESS_ICONS = new Set(['💪','🏋️','🏃','🚴','🏊','⚽','🎾','🧗','🤸','🏅','🥊'])
const CAREER_ICONS  = new Set(['💼','📚','🎯','🖥️','📊','📈','✍️','🏆','🔬','🎓','📝','💡'])

export function detectOrbitCategory(orbit) {
  const text = [orbit.name, orbit.description, orbit.goal_statement]
    .filter(Boolean).join(' ').toLowerCase()
  const icon = orbit.icon || ''

  if (HEALTH_ICONS.has(icon)  || HEALTH_WORDS.test(text))  return 'health'
  if (FAMILY_ICONS.has(icon)  || FAMILY_WORDS.test(text))  return 'family'
  if (FITNESS_ICONS.has(icon) || FITNESS_WORDS.test(text)) return 'fitness'
  if (CAREER_ICONS.has(icon)  || CAREER_WORDS.test(text))  return 'career'
  return 'other'
}

const CATEGORY_BASE = { health: 20, family: 18, fitness: 14, career: 12, other: 8 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function countActiveDays(entries, startDaysAgo, endDaysAgo, today) {
  const doneSet = new Set(
    entries
      .filter(e => e.value && e.value !== '' && e.value !== 'false')
      .map(e => e.date)
  )
  let count = 0
  for (let d = startDaysAgo; d < endDaysAgo; d++) {
    const dt = new Date(today)
    dt.setDate(dt.getDate() - d)
    // Use local date
    const ds = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().split('T')[0]
    if (doneSet.has(ds)) count++
  }
  return count
}

function daysSince(dateStr, today) {
  if (!dateStr) return null
  return Math.floor((new Date(today) - new Date(dateStr)) / 86400000)
}

export function isScheduledToday(frequency) {
  const todayNum = new Date().getDay()
  const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][todayNum]
  if (!frequency || frequency === 'daily') return true
  if (frequency === 'weekdays') return todayNum >= 1 && todayNum <= 5
  if (frequency === 'weekly')   return todayNum === 1
  if (frequency.startsWith('custom:')) {
    return (frequency.split(':')[1]?.split(',') || []).includes(todayKey)
  }
  return true
}

// ── Main scoring ──────────────────────────────────────────────────────────────
//
// Each candidate is: { item, orbit, streak, itemEntries, today }
// itemEntries = raw array { date, value } — already filtered to this item, last 60 days

export function scoreFocusCandidates(candidates) {
  const scored = []

  // Group by orbit to detect orbit-level absence
  const orbitLastDone = {}
  const orbitNeverStarted = {}
  for (const { item, orbit, itemEntries } of candidates) {
    const doneEntries = itemEntries.filter(e => e.value && e.value !== '' && e.value !== 'false')
    if (!orbitNeverStarted[orbit.id]) orbitNeverStarted[orbit.id] = true
    if (doneEntries.length > 0) {
      orbitNeverStarted[orbit.id] = false
      const lastDate = doneEntries.map(e => e.date).sort().reverse()[0]
      if (!orbitLastDone[orbit.id] || lastDate > orbitLastDone[orbit.id]) {
        orbitLastDone[orbit.id] = lastDate
      }
    }
  }

  for (const { item, orbit, streak, itemEntries, today } of candidates) {
    if (!isScheduledToday(item.frequency)) continue

    // Skip already done today
    const doneToday = itemEntries.find(e =>
      e.date === today && e.value && e.value !== '' && e.value !== 'false'
    )
    if (doneToday) continue

    const category = detectOrbitCategory(orbit)
    let score = CATEGORY_BASE[category]
    let reason = 'maintain'
    let reasonLabel = ''
    let urgency = 'low'

    // Completion rate: last 14 days vs prior 14 days
    const recent14  = countActiveDays(itemEntries, 0,  14, today)
    const prior14   = countActiveDays(itemEntries, 14, 28, today)
    const recentRate = recent14 / 14
    const priorRate  = prior14  / 14

    const neverStarted = orbitNeverStarted[orbit.id]
    const orbitAbsence = daysSince(orbitLastDone[orbit.id] || null, today)

    // Item-level last done
    const doneEntries = itemEntries.filter(e => e.value && e.value !== '' && e.value !== 'false')
    const lastDoneDate = doneEntries.length > 0
      ? doneEntries.map(e => e.date).sort().reverse()[0]
      : null
    const itemAbsence = daysSince(lastDoneDate, today)

    // ── PROTECT: streak at risk (highest priority) ────────────────────
    if (streak.atRisk && streak.current >= 2) {
      score += 100 + Math.min(streak.current * 2, 40)
      reason = 'protect'
      reasonLabel = `${streak.current}-day streak at risk`
      urgency = 'critical'
    }
    // ── REENGAGE: was doing it, clearly dropped off ───────────────────
    // priorRate >= 40%: they were genuinely doing this habit
    // recentRate < 20%: they've mostly stopped
    // itemAbsence >= 5: not just a couple days off
    else if (priorRate >= 0.4 && recentRate < 0.2 && itemAbsence !== null && itemAbsence >= 5) {
      score += 78
      reason = 'reengage'
      reasonLabel = `${itemAbsence} days since last check-in`
      urgency = 'high'
    }
    // ── DORMANT: orbit hasn't been touched in 7+ days ─────────────────
    else if (!neverStarted && orbitAbsence !== null && orbitAbsence >= 7) {
      score += 65
      reason = 'dormant'
      reasonLabel = `${orbitAbsence} days since last check-in`
      urgency = 'high'
    }
    // ── NEVER STARTED ─────────────────────────────────────────────────
    else if (neverStarted) {
      score += 55
      reason = 'begin'
      reasonLabel = 'Not started yet'
      urgency = 'medium'
    }
    // ── MAINTAIN: ongoing, healthy ────────────────────────────────────
    else {
      score += 15
      if (streak.current >= 3) {
        score += Math.min(streak.current, 20)
        reasonLabel = `${streak.current}-day streak`
      }
    }

    scored.push({
      item, orbit, streak, score, reason, reasonLabel, urgency, category,
      recentRate, priorRate
    })
  }

  // Top 3 — max 1 item per orbit (don't show 3 tasks from the same orbit)
  // Exception: if only 1 orbit exists, allow up to 3 items from it
  const singleOrbit = new Set(candidates.map(c => c.orbit.id)).size === 1
  const seenOrbits = new Set()

  return scored
    .sort((a, b) => b.score - a.score)
    .filter(r => {
      if (singleOrbit) return true
      if (seenOrbits.has(r.orbit.id)) return false
      seenOrbits.add(r.orbit.id)
      return true
    })
    .slice(0, 3)
}

// ── Narrative generator ───────────────────────────────────────────────────────
// Only uses computed facts — never invents numbers or references orbits not in the list

export function buildFocusNarrative(topItems) {
  if (!topItems || topItems.length === 0) return null

  const protecting = topItems.filter(i => i.reason === 'protect')
  const reengaging = topItems.filter(i => i.reason === 'reengage')
  const dormant    = topItems.filter(i => i.reason === 'dormant')
  const beginning  = topItems.filter(i => i.reason === 'begin')

  // Multiple streaks at risk
  if (protecting.length >= 2) {
    const names = protecting.slice(0, 2).map(i => `${i.orbit.name}`).join(' and ')
    return `${protecting.length} streaks are on the line today — ${names}. These took time to build. Don't let them slip.`
  }

  // One streak at risk
  if (protecting.length === 1) {
    const p = protecting[0]
    const others = [...reengaging, ...dormant]
    const otherMsg = others.length > 0
      ? ` ${others[0].orbit.name} also needs attention — ${others[0].reasonLabel.toLowerCase()}.`
      : ''
    return `Your ${p.streak.current}-day streak with ${p.orbit.icon} ${p.orbit.name} is on the line today. One check-in keeps it alive.${otherMsg}`
  }

  // Lost momentum — was active, dropped off
  if (reengaging.length >= 2 && protecting.length === 0) {
    const names = reengaging.slice(0, 2).map(i => `${i.orbit.icon} ${i.orbit.name}`).join(' and ')
    return `You were building real momentum with ${names} — but activity has dropped off. You've done it before. Today is the re-entry point.`
  }
  if (reengaging.length === 1 && protecting.length === 0) {
    const r = reengaging[0]
    const pct = Math.round(r.priorRate * 100)
    return `You were checking into ${r.orbit.icon} ${r.orbit.name} ${pct}% of days — then it stopped. ${r.reasonLabel}. One check-in today restarts the momentum.`
  }

  // Dormant orbit
  if (dormant.length >= 1 && protecting.length === 0 && reengaging.length === 0) {
    const d = dormant[0]
    return `${d.orbit.icon} ${d.orbit.name} has gone quiet — ${d.reasonLabel.toLowerCase()}. This is the area that will move the needle most if you show up today.`
  }

  // Never started
  if (beginning.length >= 1) {
    const b = beginning[0]
    return `You've set up ${b.orbit.icon} ${b.orbit.name} but haven't started yet. Every strong habit began with a single check-in. Make this the first one.`
  }

  // All clear — maintenance mode
  return `No urgent gaps today — your habits are holding. These are the ones worth locking in right now to keep the momentum going.`
}
