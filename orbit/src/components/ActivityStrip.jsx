import { useTheme } from '../hooks/useTheme'

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toLocalDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ActivityStrip({ entries, totalItems }) {
  const { colors } = useTheme()

  const today = new Date()
  const todayStr = toLocalDateString(today)

  // Build per-day completion map from entries
  const dayMap = {}
  for (const e of (entries || [])) {
    if (!dayMap[e.date]) dayMap[e.date] = { done: 0, attempted: 0 }
    dayMap[e.date].attempted++
    if (e.value && e.value !== '' && e.value !== 'false') {
      dayMap[e.date].done++
    }
  }

  // Generate days: 13 past + today + 4 future = 18 cells
  const days = []
  for (let i = -13; i <= 4; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dateStr = toLocalDateString(d)
    const dayData = dayMap[dateStr]
    const isFuture = i > 0
    const isToday = i === 0

    let rate = null
    if (!isFuture && dayData && totalItems > 0) {
      rate = dayData.done / totalItems
    }

    let color, bgColor, label
    if (isFuture) {
      color = colors.border
      bgColor = 'transparent'
      label = null
    } else if (rate === null || dayData === undefined) {
      // No activity at all
      color = colors.border
      bgColor = colors.bg
      label = null
    } else if (rate >= 0.7) {
      color = '#22c55e'
      bgColor = '#22c55e18'
      label = 'Great'
    } else if (rate >= 0.3) {
      color = '#f59e0b'
      bgColor = '#f59e0b14'
      label = 'Partial'
    } else {
      color = '#ef4444'
      bgColor = '#ef444414'
      label = 'Low'
    }

    days.push({ d, dateStr, isToday, isFuture, rate, color, bgColor, label, done: dayData?.done ?? 0, attempted: dayData?.attempted ?? 0 })
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <style>{`.activity-strip::-webkit-scrollbar { display: none; }`}</style>
        {days.map(({ d, dateStr, isToday, isFuture, rate, color, bgColor, label, done, attempted }) => {
          const isMonthBoundary = d.getDate() === 1

          return (
            <div
              key={dateStr}
              title={
                isFuture
                  ? `${DAY_ABBREVS[d.getDay()]} ${MONTH_ABBREVS[d.getMonth()]} ${d.getDate()}`
                  : rate !== null
                  ? `${DAY_ABBREVS[d.getDay()]} ${MONTH_ABBREVS[d.getMonth()]} ${d.getDate()} · ${done} done`
                  : `${DAY_ABBREVS[d.getDay()]} ${MONTH_ABBREVS[d.getMonth()]} ${d.getDate()} · no check-ins`
              }
              style={{
                flexShrink: 0,
                width: 42,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 4px',
                borderRadius: 10,
                background: isToday ? bgColor : isFuture ? 'transparent' : bgColor,
                border: isToday ? `2px solid ${color}` : `1px solid ${isMonthBoundary && !isFuture ? color + '55' : 'transparent'}`,
                transition: 'background 0.2s',
                cursor: 'default',
                position: 'relative',
              }}
            >
              {/* Day abbrev */}
              <div style={{
                fontSize: 9,
                fontWeight: isToday ? 800 : 600,
                color: isToday ? color : isFuture ? colors.textDim : rate !== null ? color : colors.textDim,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                opacity: isFuture ? 0.4 : 1,
              }}>
                {isToday ? 'Today' : DAY_ABBREVS[d.getDay()].slice(0, 2)}
              </div>

              {/* Color dot */}
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: isFuture ? 'transparent' : rate !== null ? color + '33' : colors.border,
                border: `2px solid ${isFuture ? colors.border : color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isFuture ? 0.25 : 1,
                transition: 'all 0.2s',
              }}>
                {!isFuture && rate !== null && rate >= 0.7 && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                )}
              </div>

              {/* Date number */}
              <div style={{
                fontSize: 11,
                fontWeight: isToday ? 800 : 500,
                color: isToday ? color : isFuture ? colors.textDim : rate !== null ? color : colors.textDim,
                opacity: isFuture ? 0.35 : 1,
              }}>
                {d.getDate()}
              </div>

              {/* Month label on 1st of month */}
              {isMonthBoundary && (
                <div style={{
                  fontSize: 8,
                  color: isFuture ? colors.textDim : color,
                  opacity: isFuture ? 0.35 : 0.7,
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}>
                  {MONTH_ABBREVS[d.getMonth()]}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: 2 }}>
        {[
          { color: '#22c55e', label: 'Great (70%+)' },
          { color: '#f59e0b', label: 'Partial (30–69%)' },
          { color: '#ef4444', label: 'Low (<30%)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 10, color: colors.textDim }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
