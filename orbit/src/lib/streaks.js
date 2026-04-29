// Streak calculation utilities

/**
 * Calculate streak for a checklist item based on check-in entries
 * @param {Array} entries - Array of { date, value } entries for the item
 * @param {string} frequency - 'daily', 'weekdays', 'weekly', or 'custom:mon,wed,fri'
 * @param {string|null} pausedAt - ISO date string when orbit was paused (null if active)
 * @returns {Object} { current: number, best: number, lastCheckedDate: string, atRisk: boolean, paused: boolean }
 */
export function calculateStreak(entries, frequency = 'daily', pausedAt = null) {
  if (!entries || entries.length === 0) {
    return { current: 0, best: 0, lastCheckedDate: null, atRisk: false, paused: !!pausedAt }
  }

  // Sort entries by date descending (most recent first)
  const sortedEntries = [...entries]
    .filter(e => e.value && e.value !== '' && e.value !== 'false')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  if (sortedEntries.length === 0) {
    return { current: 0, best: 0, lastCheckedDate: null, atRisk: false, paused: !!pausedAt }
  }

  // If paused: freeze streak at the pause date — no missed days accumulate after that point
  const today = pausedAt ? new Date(pausedAt) : new Date()
  today.setHours(0, 0, 0, 0)

  const scheduledDays = getScheduledDays(frequency)

  // Get all dates that should have been checked (working backwards from reference date)
  const expectedDates = getExpectedDates(today, scheduledDays, 365) // Look back 1 year max

  // Create a set of completed dates
  const completedDates = new Set(sortedEntries.map(e => e.date))

  // Calculate current streak
  let currentStreak = 0
  let lastCheckedDate = sortedEntries[0]?.date

  for (const expectedDate of expectedDates) {
    if (completedDates.has(expectedDate)) {
      currentStreak++
    } else {
      // If not paused: skip today (user might still check in)
      if (!pausedAt) {
        const expectedDateObj = new Date(expectedDate)
        if (expectedDateObj.getTime() === today.getTime()) {
          continue
        }
      }
      break // Streak broken
    }
  }

  // Calculate best streak (scan all entries)
  let bestStreak = currentStreak
  let tempStreak = 0

  for (let i = 0; i < expectedDates.length; i++) {
    if (completedDates.has(expectedDates[i])) {
      tempStreak++
      bestStreak = Math.max(bestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  // Paused orbits are never at risk — streak is frozen
  const atRisk = pausedAt ? false : (() => {
    const todayStr = today.toISOString().split('T')[0]
    const isTodayScheduled = isDateScheduled(today, scheduledDays)
    const checkedToday = completedDates.has(todayStr)
    return isTodayScheduled && !checkedToday && currentStreak > 0
  })()

  return {
    current: currentStreak,
    best: bestStreak,
    lastCheckedDate,
    atRisk,
    paused: !!pausedAt,
  }
}

/**
 * Get which days of week are scheduled
 */
function getScheduledDays(frequency) {
  if (frequency === 'daily') {
    return [0, 1, 2, 3, 4, 5, 6] // All days
  }
  if (frequency === 'weekdays') {
    return [1, 2, 3, 4, 5] // Mon-Fri
  }
  if (frequency === 'weekly') {
    return [1] // Monday only
  }
  if (frequency?.startsWith('custom:')) {
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
    const days = frequency.split(':')[1]?.split(',') || []
    return days.map(d => dayMap[d]).filter(d => d !== undefined)
  }
  return [0, 1, 2, 3, 4, 5, 6] // Default to daily
}

/**
 * Check if a date is scheduled
 */
function isDateScheduled(date, scheduledDays) {
  return scheduledDays.includes(date.getDay())
}

/**
 * Get expected dates working backwards from today
 */
function getExpectedDates(fromDate, scheduledDays, maxDays) {
  const dates = []
  const current = new Date(fromDate)

  for (let i = 0; i < maxDays && dates.length < 100; i++) {
    if (scheduledDays.includes(current.getDay())) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() - 1)
  }

  return dates
}

/**
 * Get streak status emoji and color
 */
export function getStreakDisplay(streak) {
  if (streak.current === 0) {
    return { emoji: '', color: 'transparent', label: '' }
  }
  if (streak.atRisk) {
    return { emoji: '⚠️', color: '#f59e0b', label: `${streak.current} day streak at risk!` }
  }
  if (streak.current >= 30) {
    return { emoji: '🔥', color: '#ef4444', label: `${streak.current} day streak!` }
  }
  if (streak.current >= 7) {
    return { emoji: '🔥', color: '#f97316', label: `${streak.current} day streak` }
  }
  if (streak.current >= 3) {
    return { emoji: '✨', color: '#eab308', label: `${streak.current} days` }
  }
  return { emoji: '🌱', color: '#22c55e', label: `${streak.current} day${streak.current > 1 ? 's' : ''}` }
}

/**
 * Calculate priority score for an item (higher = more urgent)
 */
export function calculatePriority(item, streak, lastEntry) {
  let score = 0

  // High priority if streak at risk
  if (streak.atRisk) {
    score += 100
  }

  // Higher priority for longer streaks (don't want to lose them!)
  score += Math.min(streak.current * 2, 50)

  // Priority for items not done today
  const today = new Date().toISOString().split('T')[0]
  if (!lastEntry || lastEntry.date !== today) {
    score += 30
  }

  // Slight priority for daily items over less frequent
  if (item.frequency === 'daily' || !item.frequency) {
    score += 10
  }

  return score
}
